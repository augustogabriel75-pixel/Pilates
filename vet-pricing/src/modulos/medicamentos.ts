/**
 * Módulo de medicações: converte a prescrição (dose por kg, frequência, CRI) em linha do tempo
 * de consumo, aplica a política de desperdício e deriva insumos e equipamentos associados.
 *
 *   Dose por aplicação (ativo)   = peso (kg) × dose (mg/kg)            [ou dose fixa]
 *   Volume por aplicação (mL)    = dose de ativo ÷ concentração (mg/mL), arredondado para
 *                                  cima à graduação mensurável (0,01 mL)
 *   Nº de aplicações             = ⌈ duração do tratamento ÷ intervalo ⌉
 *   CRI (por preparo)            = taxa (mg/kg/h) × peso × horas cobertas pelo preparo
 */
import {
  INTERVALO_FREQUENCIA_HORAS,
  LIMIAR_ALERTA_DESPERDICIO,
  RENOVACAO_CRI_HORAS_PADRAO,
  RESOLUCAO_MEDIDA_PADRAO,
} from '../constantes';
import { ErroCalculo, exigir, exigirNaoNegativo, exigirPositivo } from '../erros';
import type {
  Alerta,
  Especie,
  Insumo,
  LinhaMedicamento,
  Medicamento,
  PoliticaDesperdicio,
  Prescricao,
  PrescricaoCRI,
  PrescricaoIntermitente,
  UnidadeAtivo,
  UnidadeTaxaCRI,
} from '../tipos';
import { EPSILON, arredondar, arredondarParaCimaMultiplo, num, tetoSeguro } from '../util/numeros';
import { custosEmCentavos, simularConsumoRecipientes, type EventoConsumo } from './recipientes';

export interface ContextoMedicamento {
  pesoKg: number;
  especie: Especie;
  duracaoInternacaoHoras: number;
  politicaPadraoClinica?: PoliticaDesperdicio;
  limiteMicrodoseMl: number;
  /** Seringas do catálogo, em ordem crescente de capacidade. */
  seringas: readonly Insumo[];
  agulhaPadraoInsumoId?: string;
}

/** Pedido de consumo de insumo (ainda sem custo). */
export interface ConsumoInsumoOrigem {
  insumoId: string;
  quantidade: number;
  origem: string;
  memoria: string;
}

export interface UsoEquipamento {
  equipamentoId: string;
  horas: number;
  origem: string;
}

export interface ResultadoMedicamento {
  linha: LinhaMedicamento;
  consumoInsumos: ConsumoInsumoOrigem[];
  usoEquipamentos: UsoEquipamento[];
  alertas: Alerta[];
}

const VIAS_COM_SERINGA = new Set(['IV', 'IM', 'SC']);

export function calcularMedicamento(
  prescricao: Prescricao,
  medicamento: Medicamento,
  ctx: ContextoMedicamento,
): ResultadoMedicamento {
  validarMedicamento(medicamento);
  const { apresentacao, concentracao } = medicamento;
  const resolucao = apresentacao.resolucaoMedida ?? RESOLUCAO_MEDIDA_PADRAO[apresentacao.unidadeBase];
  const politica = resolverPolitica(prescricao, medicamento, ctx.politicaPadraoClinica);
  const janela = resolverJanela(prescricao, ctx.duracaoInternacaoHoras);
  const memoria: string[] = [];
  const unidadeBase = apresentacao.unidadeBase;

  let eventos: EventoConsumo[];
  let quantidadePorAplicacao: number;
  let ativoPorAplicacao: number;
  let frequenciaRotulo: string;

  if (prescricao.frequencia === 'CRI') {
    const cri = calcularEventosCRI(prescricao, medicamento, ctx.pesoKg, janela, resolucao);
    eventos = cri.eventos;
    quantidadePorAplicacao = cri.quantidadePorPreparoCompleto;
    ativoPorAplicacao = cri.ativoPorPreparoCompleto;
    frequenciaRotulo = `CRI (preparo a cada ${num(cri.renovacaoHoras)} h)`;
    memoria.push(
      `Taxa: ${num(prescricao.taxa.valor)} ${prescricao.taxa.unidade} × ${num(ctx.pesoKg)} kg = ` +
        `${num(cri.ativoPorHora)} ${concentracao.unidade}/h = ${num(cri.quantidadePorHora)} ${unidadeBase}/h`,
      `${eventos.length} preparo(s) de até ${num(cri.renovacaoHoras)} h: ${eventos.map((e) => `${num(e.quantidade)} ${unidadeBase}`).join(' + ')}`,
    );
  } else {
    const intermitente = calcularDoseIntermitente(prescricao, medicamento, ctx.pesoKg);
    ativoPorAplicacao = intermitente.ativo;
    quantidadePorAplicacao = arredondarParaCimaMultiplo(intermitente.quantidadeBase, resolucao);
    const { horarios, rotulo } = gerarHorariosIntermitentes(prescricao, janela);
    frequenciaRotulo = rotulo;
    eventos = horarios.map((hora) => ({ hora, quantidade: quantidadePorAplicacao }));
    memoria.push(
      `Dose: ${descreverDose(prescricao, ctx.pesoKg)} = ${num(ativoPorAplicacao)} ${concentracao.unidade} ÷ ` +
        `${num(concentracao.valor)} ${concentracao.unidade}/${unidadeBase} = ${num(intermitente.quantidadeBase)} ${unidadeBase}` +
        (quantidadePorAplicacao !== arredondar(intermitente.quantidadeBase)
          ? ` → ${num(quantidadePorAplicacao)} ${unidadeBase} (arredondado à graduação de ${num(resolucao)} ${unidadeBase})`
          : ''),
      `${eventos.length} aplicação(ões) ${rotulo} entre ${num(janela.inicio)} h e ${num(janela.fim)} h`,
    );
  }

  const consumo = simularConsumoRecipientes(
    eventos,
    {
      capacidade: apresentacao.quantidadePorRecipiente,
      precoCusto: medicamento.precoCustoRecipiente,
      validadeAposAbertoHoras: medicamento.validadeAposAbertoHoras,
    },
    politica,
  );
  memoria.push(descreverPolitica(politica, consumo, medicamento));

  const linha: LinhaMedicamento = {
    ...(prescricao.id !== undefined && { prescricaoId: prescricao.id }),
    medicamentoId: medicamento.id,
    nome: medicamento.nome,
    principioAtivo: medicamento.principioAtivo,
    via: prescricao.via,
    frequencia: frequenciaRotulo,
    politicaDesperdicio: politica,
    doseAtivoPorAplicacao: { valor: arredondar(ativoPorAplicacao, 4), unidade: concentracao.unidade },
    quantidadePorAplicacao,
    unidadeBase,
    numeroAplicacoes: eventos.length,
    horariosAplicacao: eventos.map((e) => arredondar(e.hora, 4)),
    quantidadeTotalUtilizada: consumo.quantidadeUtilizada,
    quantidadeDesperdicada: consumo.quantidadeDesperdicada,
    recipientesAbertos: consumo.recipientesAbertos,
    custoPorUnidadeBase: arredondar(medicamento.precoCustoRecipiente / apresentacao.quantidadePorRecipiente, 6),
    ...custosEmCentavos(consumo),
    memoriaCalculo: memoria,
  };

  return {
    linha,
    consumoInsumos: derivarInsumos(prescricao, medicamento, linha, consumo.recipientesAbertos, ctx),
    usoEquipamentos: prescricao.equipamentoId
      ? [{ equipamentoId: prescricao.equipamentoId, horas: janela.fim - janela.inicio, origem: medicamento.nome }]
      : [],
    alertas: gerarAlertas(prescricao, medicamento, linha, ctx),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dose e linha do tempo
// ─────────────────────────────────────────────────────────────────────────────

interface Janela {
  inicio: number;
  fim: number;
}

function resolverJanela(prescricao: Prescricao, duracaoInternacao: number): Janela {
  const inicio = prescricao.inicioHora ?? 0;
  exigirNaoNegativo(inicio, `prescricao[${prescricao.medicamentoId}].inicioHora`);
  exigir(
    inicio < duracaoInternacao,
    'JANELA_INVALIDA',
    `A prescrição de "${prescricao.medicamentoId}" começa (${inicio} h) depois do fim da internação (${duracaoInternacao} h).`,
    'prescricoes.inicioHora',
  );
  if (prescricao.duracaoHoras !== undefined) exigirPositivo(prescricao.duracaoHoras, `prescricao[${prescricao.medicamentoId}].duracaoHoras`);
  const fim = Math.min(inicio + (prescricao.duracaoHoras ?? duracaoInternacao), duracaoInternacao);
  return { inicio, fim };
}

function resolverPolitica(
  prescricao: Prescricao,
  medicamento: Medicamento,
  padraoClinica: PoliticaDesperdicio | undefined,
): PoliticaDesperdicio {
  if (prescricao.politicaDesperdicio) return prescricao.politicaDesperdicio;
  if (medicamento.politicaDesperdicioPadrao) return medicamento.politicaDesperdicioPadrao;
  if (medicamento.usoUnico) return 'RECIPIENTE_INTEIRO';
  if (medicamento.validadeAposAbertoHoras != null) return 'POR_ESTABILIDADE';
  return padraoClinica ?? 'FRACIONADO';
}

export function intervaloDaFrequencia(frequencia: PrescricaoIntermitente['frequencia']): number | null {
  if (frequencia === 'DOSE_UNICA') return null;
  if (typeof frequencia === 'object') {
    exigirPositivo(frequencia.intervaloHoras, 'frequencia.intervaloHoras');
    return frequencia.intervaloHoras;
  }
  const intervalo = INTERVALO_FREQUENCIA_HORAS[frequencia];
  exigir(intervalo, 'FREQUENCIA_INVALIDA', `Frequência desconhecida: ${String(frequencia)}.`, 'frequencia');
  return intervalo;
}

function gerarHorariosIntermitentes(prescricao: PrescricaoIntermitente, janela: Janela): { horarios: number[]; rotulo: string } {
  const intervalo = intervaloDaFrequencia(prescricao.frequencia);
  if (intervalo === null) return { horarios: [janela.inicio], rotulo: 'dose única' };
  const rotulo =
    typeof prescricao.frequencia === 'object' ? `a cada ${num(intervalo)} h` : `${prescricao.frequencia} (${num(intervalo)}/${num(intervalo)} h)`;
  const n = tetoSeguro((janela.fim - janela.inicio) / intervalo);
  return { horarios: Array.from({ length: n }, (_, k) => janela.inicio + k * intervalo), rotulo };
}

function converterAtivo(valor: number, de: UnidadeAtivo, para: UnidadeAtivo, contexto: string): number {
  if (de === para) return valor;
  if (de === 'mg' && para === 'mcg') return valor * 1000;
  if (de === 'mcg' && para === 'mg') return valor / 1000;
  throw new ErroCalculo(
    'UNIDADE_INCOMPATIVEL',
    `${contexto}: dose em ${de} é incompatível com concentração em ${para}.`,
    'prescricoes.dose.unidade',
  );
}

function exigirUnidadeBase(medicamento: Medicamento, esperada: 'mL' | 'comprimido', unidadeDose: string): void {
  exigir(
    medicamento.apresentacao.unidadeBase === esperada,
    'UNIDADE_INCOMPATIVEL',
    `${medicamento.nome}: dose em "${unidadeDose}" exige apresentação em ${esperada} (cadastrado: ${medicamento.apresentacao.unidadeBase}).`,
    'prescricoes.dose.unidade',
  );
}

/** Retorna a dose por aplicação em ativo (na unidade da concentração) e em unidade base. */
export function calcularDoseIntermitente(
  prescricao: PrescricaoIntermitente,
  medicamento: Medicamento,
  pesoKg: number,
): { ativo: number; quantidadeBase: number } {
  const { valor, unidade } = prescricao.dose;
  exigirPositivo(valor, `prescricao[${medicamento.id}].dose.valor`);
  const conc = medicamento.concentracao;

  switch (unidade) {
    case 'mL/kg':
    case 'mL': {
      exigirUnidadeBase(medicamento, 'mL', unidade);
      const quantidadeBase = unidade === 'mL/kg' ? valor * pesoKg : valor;
      return { ativo: quantidadeBase * conc.valor, quantidadeBase };
    }
    case 'comprimido':
      exigirUnidadeBase(medicamento, 'comprimido', unidade);
      return { ativo: valor * conc.valor, quantidadeBase: valor };
    default: {
      const [unidadeAtivo, porKg] = unidade.split('/') as [UnidadeAtivo, string | undefined];
      const ativoNaUnidadeDaDose = porKg ? valor * pesoKg : valor;
      const ativo = converterAtivo(ativoNaUnidadeDaDose, unidadeAtivo, conc.unidade, medicamento.nome);
      return { ativo, quantidadeBase: ativo / conc.valor };
    }
  }
}

/** Converte a taxa de CRI em ativo/h e unidade base/h. */
export function calcularTaxaHorariaCRI(
  taxa: { valor: number; unidade: UnidadeTaxaCRI },
  medicamento: Medicamento,
  pesoKg: number,
): { ativoPorHora: number; quantidadePorHora: number } {
  exigirPositivo(taxa.valor, `prescricao[${medicamento.id}].taxa.valor`);
  const conc = medicamento.concentracao;
  if (taxa.unidade === 'mL/kg/h' || taxa.unidade === 'mL/h') {
    exigirUnidadeBase(medicamento, 'mL', taxa.unidade);
    const quantidadePorHora = taxa.unidade === 'mL/kg/h' ? taxa.valor * pesoKg : taxa.valor;
    return { ativoPorHora: quantidadePorHora * conc.valor, quantidadePorHora };
  }
  const porHora: Record<'mg/kg/h' | 'mcg/kg/h' | 'mcg/kg/min', { unidade: UnidadeAtivo; fator: number }> = {
    'mg/kg/h': { unidade: 'mg', fator: 1 },
    'mcg/kg/h': { unidade: 'mcg', fator: 1 },
    'mcg/kg/min': { unidade: 'mcg', fator: 60 },
  };
  const { unidade, fator } = porHora[taxa.unidade];
  const ativoPorHora = converterAtivo(taxa.valor * pesoKg * fator, unidade, conc.unidade, medicamento.nome);
  return { ativoPorHora, quantidadePorHora: ativoPorHora / conc.valor };
}

function calcularEventosCRI(prescricao: PrescricaoCRI, medicamento: Medicamento, pesoKg: number, janela: Janela, resolucao: number) {
  const renovacaoHoras = prescricao.renovacaoHoras ?? RENOVACAO_CRI_HORAS_PADRAO;
  exigirPositivo(renovacaoHoras, `prescricao[${medicamento.id}].renovacaoHoras`);
  const { ativoPorHora, quantidadePorHora } = calcularTaxaHorariaCRI(prescricao.taxa, medicamento, pesoKg);
  const eventos: EventoConsumo[] = [];
  for (let hora = janela.inicio; hora < janela.fim - EPSILON; hora += renovacaoHoras) {
    const horasCobertas = Math.min(renovacaoHoras, janela.fim - hora);
    eventos.push({ hora, quantidade: arredondarParaCimaMultiplo(quantidadePorHora * horasCobertas, resolucao) });
  }
  return {
    eventos,
    renovacaoHoras,
    ativoPorHora,
    quantidadePorHora,
    ativoPorPreparoCompleto: ativoPorHora * renovacaoHoras,
    quantidadePorPreparoCompleto: arredondarParaCimaMultiplo(quantidadePorHora * renovacaoHoras, resolucao),
  };
}

function descreverDose(prescricao: PrescricaoIntermitente, pesoKg: number): string {
  const { valor, unidade } = prescricao.dose;
  return unidade.endsWith('/kg') ? `${num(valor)} ${unidade} × ${num(pesoKg)} kg` : `${num(valor)} ${unidade}`;
}

function descreverPolitica(
  politica: PoliticaDesperdicio,
  consumo: ReturnType<typeof simularConsumoRecipientes>,
  medicamento: Medicamento,
): string {
  const { unidadeBase, quantidadePorRecipiente, tipoRecipiente } = medicamento.apresentacao;
  const rec = `${tipoRecipiente.toLowerCase().replace('_', '-')} de ${num(quantidadePorRecipiente)} ${unidadeBase}`;
  const usado = `${num(consumo.quantidadeUtilizada)} ${unidadeBase}`;
  switch (politica) {
    case 'FRACIONADO':
      return `Fracionado: ${usado} × R$ ${num(medicamento.precoCustoRecipiente / quantidadePorRecipiente)}/${unidadeBase} (equivale a ${num(consumo.quantidadeUtilizada / quantidadePorRecipiente)} ${rec})`;
    case 'RECIPIENTE_INTEIRO':
      return `Recipiente inteiro (uso único): ${consumo.recipientesAbertos} × ${rec}; usado ${usado}, descartado ${num(consumo.quantidadeDesperdicada)} ${unidadeBase}`;
    case 'POR_ESTABILIDADE':
      return (
        `Por estabilidade (validade aberto: ${medicamento.validadeAposAbertoHoras ?? '∞'} h): ${consumo.recipientesAbertos} × ${rec} ` +
        `abertos nas horas [${consumo.horasAbertura.map((h) => num(h)).join(', ')}]; usado ${usado}, descartado ${num(consumo.quantidadeDesperdicada)} ${unidadeBase}`
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Insumos derivados e alertas
// ─────────────────────────────────────────────────────────────────────────────

function derivarInsumos(
  prescricao: Prescricao,
  medicamento: Medicamento,
  linha: LinhaMedicamento,
  recipientesAbertos: number,
  ctx: ContextoMedicamento,
): ConsumoInsumoOrigem[] {
  const consumos: ConsumoInsumoOrigem[] = [];
  const n = linha.numeroAplicacoes;
  const rotuloAplicacao = prescricao.frequencia === 'CRI' ? 'preparo(s)' : 'aplicação(ões)';

  for (const item of prescricao.insumosPorAplicacao ?? []) {
    exigirPositivo(item.quantidade, `prescricao[${medicamento.id}].insumosPorAplicacao.quantidade`);
    consumos.push({
      insumoId: item.insumoId,
      quantidade: item.quantidade * n,
      origem: `Aplicação: ${medicamento.nome}`,
      memoria: `${num(item.quantidade)} × ${n} ${rotuloAplicacao}`,
    });
  }

  const usaSeringaAutomatica =
    prescricao.frequencia !== 'CRI' &&
    (prescricao.seringaAutomatica ?? true) &&
    VIAS_COM_SERINGA.has(prescricao.via) &&
    linha.unidadeBase === 'mL' &&
    ctx.seringas.length > 0;

  if (usaSeringaAutomatica) {
    const { seringa, quantidade } = selecionarSeringa(linha.quantidadePorAplicacao, ctx.seringas);
    consumos.push({
      insumoId: seringa.id,
      quantidade: quantidade * n,
      origem: `Aplicação: ${medicamento.nome}`,
      memoria: `Seringa auto-selecionada (${num(seringa.capacidadeMl ?? 0)} mL ≥ ${num(linha.quantidadePorAplicacao)} mL): ${quantidade} × ${n} ${rotuloAplicacao}`,
    });
    if (ctx.agulhaPadraoInsumoId) {
      consumos.push({
        insumoId: ctx.agulhaPadraoInsumoId,
        quantidade: quantidade * n,
        origem: `Aplicação: ${medicamento.nome}`,
        memoria: `1 agulha por seringa: ${quantidade} × ${n} ${rotuloAplicacao}`,
      });
    }
  }

  // Diluente/insumos por recipiente aberto. No fracionado, proporcional à fração consumida.
  const fatorRecipientes =
    linha.politicaDesperdicio === 'FRACIONADO'
      ? linha.quantidadeTotalUtilizada / medicamento.apresentacao.quantidadePorRecipiente
      : recipientesAbertos;
  for (const item of medicamento.insumosPorRecipienteAberto ?? []) {
    consumos.push({
      insumoId: item.insumoId,
      quantidade: item.quantidade * fatorRecipientes,
      origem: `Preparo/reconstituição: ${medicamento.nome}`,
      memoria: `${num(item.quantidade)} × ${num(fatorRecipientes)} recipiente(s) aberto(s)`,
    });
  }

  return consumos;
}

/** Menor seringa que comporta o volume; se nenhuma comportar, usa N da maior. */
export function selecionarSeringa(volumeMl: number, seringas: readonly Insumo[]): { seringa: Insumo; quantidade: number } {
  const adequada = seringas.find((s) => (s.capacidadeMl ?? 0) >= volumeMl - EPSILON);
  if (adequada) return { seringa: adequada, quantidade: 1 };
  const maior = seringas[seringas.length - 1]!;
  return { seringa: maior, quantidade: tetoSeguro(volumeMl / (maior.capacidadeMl ?? 1)) };
}

function gerarAlertas(prescricao: Prescricao, medicamento: Medicamento, linha: LinhaMedicamento, ctx: ContextoMedicamento): Alerta[] {
  const alertas: Alerta[] = [];

  if (linha.unidadeBase === 'mL' && prescricao.frequencia !== 'CRI' && linha.quantidadePorAplicacao < ctx.limiteMicrodoseMl) {
    alertas.push({
      nivel: 'ATENCAO',
      codigo: 'MICRODOSE',
      mensagem:
        `${medicamento.nome}: ${num(linha.quantidadePorAplicacao)} mL por aplicação (< ${num(ctx.limiteMicrodoseMl)} mL). ` +
        'Considere diluição prévia ou seringa de insulina/tuberculina para garantir a precisão da dose.',
    });
  }

  if (linha.custoTotal > 0 && linha.custoDesperdicio / linha.custoTotal >= LIMIAR_ALERTA_DESPERDICIO) {
    alertas.push({
      nivel: 'ATENCAO',
      codigo: 'DESPERDICIO_ELEVADO',
      mensagem:
        `${medicamento.nome}: ${Math.round((linha.custoDesperdicio / linha.custoTotal) * 100)}% do custo é sobra descartada ` +
        `(${num(linha.quantidadeDesperdicada)} ${linha.unidadeBase}). Avalie apresentação menor ou compartilhamento do frasco.`,
    });
  }

  const faixa = medicamento.faixaDoseReferencia?.[ctx.especie];
  if (faixa && prescricao.frequencia !== 'CRI' && faixa.unidade === prescricao.dose.unidade) {
    const { valor } = prescricao.dose;
    if (valor < faixa.min - EPSILON || valor > faixa.max + EPSILON) {
      alertas.push({
        nivel: 'CRITICO',
        codigo: 'DOSE_FORA_DA_FAIXA',
        mensagem: `${medicamento.nome}: dose de ${num(valor)} ${faixa.unidade} fora da faixa de referência cadastrada para a espécie (${num(faixa.min)}–${num(faixa.max)} ${faixa.unidade}). Confirme a prescrição.`,
      });
    }
  }

  if (medicamento.controlado) {
    alertas.push({
      nivel: 'INFO',
      codigo: 'CONTROLADO',
      mensagem: `${medicamento.nome}: medicamento controlado — exige receituário e escrituração específicos.`,
    });
  }

  return alertas;
}

function validarMedicamento(m: Medicamento): void {
  exigirPositivo(m.apresentacao.quantidadePorRecipiente, `medicamento[${m.id}].apresentacao.quantidadePorRecipiente`);
  exigirPositivo(m.concentracao.valor, `medicamento[${m.id}].concentracao.valor`);
  exigirNaoNegativo(m.precoCustoRecipiente, `medicamento[${m.id}].precoCustoRecipiente`);
  if (m.validadeAposAbertoHoras != null) exigirPositivo(m.validadeAposAbertoHoras, `medicamento[${m.id}].validadeAposAbertoHoras`);
  if (m.apresentacao.resolucaoMedida !== undefined) exigirPositivo(m.apresentacao.resolucaoMedida, `medicamento[${m.id}].apresentacao.resolucaoMedida`);
}
