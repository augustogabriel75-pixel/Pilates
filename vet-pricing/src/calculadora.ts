/**
 * Calculadora de custo e preço de internação veterinária.
 *
 * `calculateHospitalizationCost` é uma função PURA: não acessa banco, relógio nem rede.
 * Recebe catálogo e configuração já carregados e devolve o detalhamento completo, com
 * memória de cálculo em cada linha. Lança `ErroCalculo` para entradas inválidas e devolve
 * `alertas` para situações que não impedem o cálculo (microdose, desperdício, peso atípico).
 *
 * Pipeline:
 *   1. Validação da entrada
 *   2. Medicamentos (dose → linha do tempo → recipientes → insumos/equipamentos derivados)
 *   3. Fluidoterapia (volume → bolsas → equipo/bomba)
 *   4. Manejos (horários distintos) e insumos por regra
 *   5. Margem de segurança sobre custos diretos
 *   6. Custos operacionais (leito, equipamentos, mão de obra)
 *   7. Impostos, taxa de pagamento, margem → preço final e diária
 */
import { FAIXA_PESO_PLAUSIVEL_KG, LIMITE_MICRODOSE_ML_PADRAO, VERSAO_ALGORITMO } from './constantes';
import { buscarPorId, exigir, exigirNaoNegativo, exigirPositivo } from './erros';
import { aliquotaTotalImpostos, calcularPrecoVenda, gerarTabelaFormasPagamento, taxaDaFormaPagamento } from './modulos/comercial';
import { calcularFluidoterapia, type ResultadoFluidoterapia } from './modulos/fluidoterapia';
import { consolidarInsumos, contarManejos, expandirInsumosPrevistos, valorizarConsumo } from './modulos/insumos';
import { calcularMedicamento, type ConsumoInsumoOrigem, type ResultadoMedicamento, type UsoEquipamento } from './modulos/medicamentos';
import { calcularCustosOperacionais, obterConfigCategoria } from './modulos/operacional';
import type { Alerta, EntradaCalculo, Insumo, InternacaoOrcamento, LinhaInsumo, ResultadoCalculo, StatusOrcamento } from './tipos';
import { arredondar, dinheiro, pct, somarDinheiro, tetoSeguro } from './util/numeros';

const indexar = <T extends { id: string }>(itens: readonly T[]): Map<string, T> => new Map(itens.map((i) => [i.id, i]));

export function calculateHospitalizationCost(entrada: EntradaCalculo): ResultadoCalculo {
  const { paciente, internacao, clinica, catalogo, comercial, margemSeguranca } = entrada;
  validarEntrada(entrada);

  const horas = internacao.duracaoHoras;
  const dias = tetoSeguro(horas / 24);
  const medicamentos = indexar(catalogo.medicamentos);
  const insumos = indexar(catalogo.insumos);
  const equipamentos = indexar(catalogo.equipamentos);
  const profissionais = indexar(clinica.profissionais);
  const configCategoria = obterConfigCategoria(clinica, internacao.categoriaLeito);
  const alertas: Alerta[] = [...alertasPaciente(entrada)];

  // 2. Medicamentos ──────────────────────────────────────────────────────────
  const seringas = (clinica.catalogoSeringas ?? [])
    .map((id) => buscarPorId(insumos, id, 'Seringa', 'clinica.catalogoSeringas'))
    .map((s) => {
      exigirPositivo(s.capacidadeMl ?? 0, `insumo[${s.id}].capacidadeMl`);
      return s;
    })
    .sort((a, b) => (a.capacidadeMl ?? 0) - (b.capacidadeMl ?? 0));

  const resultadosMed: ResultadoMedicamento[] = entrada.prescricoes.map((rx, i) =>
    calcularMedicamento(rx, buscarPorId(medicamentos, rx.medicamentoId, 'Medicamento', `prescricoes[${i}].medicamentoId`), {
      pesoKg: paciente.pesoKg,
      especie: paciente.especie,
      duracaoInternacaoHoras: horas,
      ...(clinica.politicaDesperdicioPadrao && { politicaPadraoClinica: clinica.politicaDesperdicioPadrao }),
      limiteMicrodoseMl: clinica.limiteMicrodoseMl ?? LIMITE_MICRODOSE_ML_PADRAO,
      seringas,
      ...(clinica.agulhaPadraoInsumoId && { agulhaPadraoInsumoId: clinica.agulhaPadraoInsumoId }),
    }),
  );

  // 3. Fluidoterapia ─────────────────────────────────────────────────────────
  let fluido: ResultadoFluidoterapia | null = null;
  if (entrada.fluidoterapia) {
    const bolsa = buscarPorId(insumos, entrada.fluidoterapia.solucaoInsumoId, 'Insumo (bolsa de fluido)', 'fluidoterapia.solucaoInsumoId');
    fluido = calcularFluidoterapia(entrada.fluidoterapia, bolsa, { pesoKg: paciente.pesoKg, duracaoInternacaoHoras: horas });
  }

  // 4. Manejos e insumos ─────────────────────────────────────────────────────
  const horariosMedicacao = resultadosMed.flatMap((r) => r.linha.horariosAplicacao);
  const manejos = contarManejos([...horariosMedicacao, ...(fluido?.horasTrocaBolsa ?? [])], horas, configCategoria.intervaloManejoRotinaHoras);
  const aplicacoes = resultadosMed.reduce((acc, r) => acc + r.linha.numeroAplicacoes, 0);

  const consumos: ConsumoInsumoOrigem[] = [
    ...resultadosMed.flatMap((r) => r.consumoInsumos),
    ...(fluido?.consumoInsumos ?? []),
    ...expandirInsumosPrevistos(entrada.insumos, {
      horas,
      dias,
      pesoKg: paciente.pesoKg,
      manejos,
      aplicacoes,
      coletas: internacao.coletasExamesPrevistas ?? 0,
    }),
  ];
  const linhasInsumo: LinhaInsumo[] = consumos.map((c) =>
    valorizarConsumo(c, buscarPorId<Insumo>(insumos, c.insumoId, 'Insumo', `insumos[${c.insumoId}]`)),
  );

  // 5. Custos diretos + margem de segurança ──────────────────────────────────
  const custoMedicamentos = somarDinheiro(resultadosMed.map((r) => r.linha.custoTotal));
  const custoFluidoterapia = fluido?.linha.custoTotal ?? 0;
  const custoInsumos = somarDinheiro(linhasInsumo.map((l) => l.custoTotal));
  const seguranca = {
    medicamentos: dinheiro(custoMedicamentos * pct(margemSeguranca.medicamentosPct)),
    fluidoterapia: dinheiro(custoFluidoterapia * pct(margemSeguranca.fluidoterapiaPct ?? 0)),
    insumos: dinheiro(custoInsumos * pct(margemSeguranca.insumosPct)),
    total: 0,
  };
  seguranca.total = somarDinheiro([seguranca.medicamentos, seguranca.fluidoterapia, seguranca.insumos]);
  const custoDireto = somarDinheiro([custoMedicamentos, custoFluidoterapia, custoInsumos, seguranca.total]);

  // 6. Custos operacionais ───────────────────────────────────────────────────
  const usosEquipamentos: UsoEquipamento[] = [...resultadosMed.flatMap((r) => r.usoEquipamentos), ...(fluido?.usoEquipamentos ?? [])];
  const operacional = calcularCustosOperacionais({
    clinica,
    categoria: internacao.categoriaLeito,
    horas,
    equipamentos,
    profissionais,
    usosEquipamentos,
  });
  const custoLeito = operacional.leito.custoTotal;
  const custoEquipamentos = somarDinheiro(operacional.equipamentos.map((e) => e.custoTotal));
  const custoMaoDeObra = somarDinheiro(operacional.maoDeObra.map((e) => e.custoTotal));
  const custoIndireto = somarDinheiro([custoLeito, custoEquipamentos, custoMaoDeObra]);
  const custoTotal = somarDinheiro([custoDireto, custoIndireto]);

  // 7. Preço ─────────────────────────────────────────────────────────────────
  const aliquotaImpostosPct = aliquotaTotalImpostos(comercial);
  const taxaPagamentoPct = taxaDaFormaPagamento(comercial.formaPagamento, comercial.taxasPagamento);
  const preco = calcularPrecoVenda(custoTotal, aliquotaImpostosPct, taxaPagamentoPct, comercial.margemLucroPct, comercial.modoMargem ?? 'SOBRE_CUSTO');

  alertas.push(...resultadosMed.flatMap((r) => r.alertas));
  if (seguranca.total === 0 && custoDireto > 0) {
    alertas.push({ nivel: 'INFO', codigo: 'SEM_MARGEM_SEGURANCA', mensagem: 'Nenhuma margem de segurança aplicada: perdas de insumos não estão cobertas no preço.' });
  }

  return {
    versaoAlgoritmo: VERSAO_ALGORITMO,
    paciente: { id: paciente.id, nome: paciente.nome, especie: paciente.especie, pesoKg: paciente.pesoKg },
    duracaoHoras: horas,
    dias,
    categoriaLeito: internacao.categoriaLeito,
    medicamentos: resultadosMed.map((r) => r.linha),
    fluidoterapia: fluido?.linha ?? null,
    insumos: linhasInsumo,
    insumosConsolidados: consolidarInsumos(linhasInsumo),
    operacional,
    manejosPrevistos: manejos,
    resumo: {
      custoMedicamentos,
      custoFluidoterapia,
      custoInsumos,
      margemSeguranca: seguranca,
      custoDireto,
      custoLeito,
      custoEquipamentos,
      custoMaoDeObra,
      custoIndireto,
      custoTotal,
      custoPorDia: dinheiro(custoTotal / (horas / 24)),
      lucro: preco.lucro,
      impostos: preco.impostos,
      taxaPagamento: preco.taxaPagamento,
      precoFinal: preco.precoFinal,
      precoDiaria: dinheiro(preco.precoFinal / (horas / 24)),
      aliquotaImpostosPct,
      taxaPagamentoPct,
      margemLiquidaSobrePrecoPct: preco.precoFinal > 0 ? arredondar((preco.lucro / preco.precoFinal) * 100, 2) : 0,
      markupSobreCustoPct: custoTotal > 0 ? arredondar((preco.precoFinal / custoTotal - 1) * 100, 2) : 0,
    },
    tabelaFormasPagamento: gerarTabelaFormasPagamento(custoTotal, comercial),
    alertas,
  };
}

/** Mapeia o resultado para a entidade persistida `InternacaoOrcamento`. */
export function paraInternacaoOrcamento(
  id: string,
  entrada: EntradaCalculo,
  resultado: ResultadoCalculo,
  opcoes: { criadoEm: string; status?: StatusOrcamento },
): InternacaoOrcamento {
  return {
    id,
    pacienteId: entrada.paciente.id,
    duracaoHoras: resultado.duracaoHoras,
    categoriaLeito: resultado.categoriaLeito,
    listaMedicacoes: resultado.medicamentos,
    listaInsumos: resultado.insumos,
    fluidoterapia: resultado.fluidoterapia,
    custoDireto: resultado.resumo.custoDireto,
    custosFixosCalculados: resultado.resumo.custoIndireto,
    custoTotal: resultado.resumo.custoTotal,
    margemLucroPct: entrada.comercial.margemLucroPct,
    impostosPct: resultado.resumo.aliquotaImpostosPct,
    taxaPagamentoPct: resultado.resumo.taxaPagamentoPct,
    precoSugeridoTotal: resultado.resumo.precoFinal,
    precoSugeridoDiaria: resultado.resumo.precoDiaria,
    status: opcoes.status ?? 'RASCUNHO',
    versaoAlgoritmo: resultado.versaoAlgoritmo,
    criadoEm: opcoes.criadoEm,
    snapshot: resultado,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validação e alertas gerais
// ─────────────────────────────────────────────────────────────────────────────

function validarEntrada(entrada: EntradaCalculo): void {
  const { paciente, internacao, margemSeguranca, comercial } = entrada;
  exigirPositivo(paciente.pesoKg, 'paciente.pesoKg');
  exigir(FAIXA_PESO_PLAUSIVEL_KG[paciente.especie], 'ESPECIE_INVALIDA', `Espécie desconhecida: ${paciente.especie}.`, 'paciente.especie');
  exigirPositivo(internacao.duracaoHoras, 'internacao.duracaoHoras');
  exigirNaoNegativo(internacao.coletasExamesPrevistas ?? 0, 'internacao.coletasExamesPrevistas');
  exigirNaoNegativo(margemSeguranca.medicamentosPct, 'margemSeguranca.medicamentosPct');
  exigirNaoNegativo(margemSeguranca.insumosPct, 'margemSeguranca.insumosPct');
  exigirNaoNegativo(margemSeguranca.fluidoterapiaPct ?? 0, 'margemSeguranca.fluidoterapiaPct');
  exigirNaoNegativo(comercial.margemLucroPct, 'comercial.margemLucroPct');

  const ids = new Set<string>();
  for (const rx of entrada.prescricoes) {
    if (rx.id === undefined) continue;
    exigir(!ids.has(rx.id), 'ID_DUPLICADO', `Prescrição com ID duplicado: ${rx.id}.`, 'prescricoes.id');
    ids.add(rx.id);
  }
}

function alertasPaciente(entrada: EntradaCalculo): Alerta[] {
  const { especie, pesoKg } = entrada.paciente;
  const faixa = FAIXA_PESO_PLAUSIVEL_KG[especie];
  if (pesoKg >= faixa.min && pesoKg <= faixa.max) return [];
  return [
    {
      nivel: 'CRITICO',
      codigo: 'PESO_ATIPICO',
      mensagem: `Peso de ${pesoKg} kg fora da faixa usual para ${especie} (${faixa.min}–${faixa.max} kg). Confira a unidade (g × kg): todas as doses dependem do peso.`,
    },
  ];
}
