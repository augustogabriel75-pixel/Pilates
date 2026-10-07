import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { catalogo, clinica } from '../examples/dados-exemplo';
import { ErroCalculo } from '../src/erros';
import { calcularPrecoVenda, gerarTabelaFormasPagamento, taxaDaFormaPagamento } from '../src/modulos/comercial';
import { calcularFluidoterapia } from '../src/modulos/fluidoterapia';
import { calcularQuantidadeRegra, contarManejos, valorizarConsumo, type ContextoInsumos } from '../src/modulos/insumos';
import { calcularDoseIntermitente, calcularMedicamento, calcularTaxaHorariaCRI, selecionarSeringa, type ContextoMedicamento } from '../src/modulos/medicamentos';
import { custoBaseLeitoHora, custoHoraEquipamento, custoHoraProfissional } from '../src/modulos/operacional';
import { simularConsumoRecipientes } from '../src/modulos/recipientes';
import type { Insumo, Medicamento, Prescricao } from '../src/tipos';
import { arredondarParaCimaMultiplo, somarDinheiro, tetoSeguro } from '../src/util/numeros';

const med = (id: string): Medicamento => catalogo.medicamentos.find((m) => m.id === id)!;
const insumo = (id: string): Insumo => catalogo.insumos.find((i) => i.id === id)!;
const seringas = clinica.catalogoSeringas!.map(insumo).sort((a, b) => a.capacidadeMl! - b.capacidadeMl!);

const ctxMed = (pesoKg: number, duracao = 72, extra: Partial<ContextoMedicamento> = {}): ContextoMedicamento => ({
  pesoKg,
  especie: 'CAO',
  duracaoInternacaoHoras: duracao,
  limiteMicrodoseMl: 0.1,
  seringas,
  agulhaPadraoInsumoId: 'agulha-25x7',
  ...extra,
});

const aproximado = (atual: number, esperado: number, tol = 1e-6) =>
  assert.ok(Math.abs(atual - esperado) <= tol, `esperado ≈ ${esperado}, obtido ${atual}`);

const erroComCodigo = (codigo: string) => (e: unknown) => e instanceof ErroCalculo && e.codigo === codigo;

describe('util/numeros', () => {
  it('teto tolera ruído de ponto flutuante', () => {
    assert.equal(tetoSeguro((0.1 + 0.2) / 0.3), 1);
    assert.equal(tetoSeguro(3.0000001), 4);
  });

  it('arredonda dose para cima à graduação', () => {
    assert.equal(arredondarParaCimaMultiplo(0.07, 0.01), 0.07);
    assert.equal(arredondarParaCimaMultiplo(0.2333, 0.01), 0.24);
    assert.equal(arredondarParaCimaMultiplo(0.6, 0.25), 0.75);
  });

  it('soma dinheiro em centavos inteiros', () => {
    assert.equal(somarDinheiro([0.1, 0.2]), 0.3);
    assert.equal(somarDinheiro(Array(10).fill(0.1)), 1);
  });
});

describe('recipientes', () => {
  const eventos = [0, 12, 24, 36, 48, 60].map((hora) => ({ hora, quantidade: 6.25 }));
  const frasco = { capacidade: 10, precoCusto: 9.8, validadeAposAbertoHoras: 24 };

  it('FRACIONADO cobra apenas o volume usado', () => {
    const r = simularConsumoRecipientes(eventos, frasco, 'FRACIONADO');
    assert.equal(r.quantidadeUtilizada, 37.5);
    assert.equal(r.quantidadeDesperdicada, 0);
    aproximado(r.custoTotal, 37.5 * 0.98);
    assert.equal(r.recipientesAbertos, 4); // referência de estoque
  });

  it('RECIPIENTE_INTEIRO abre recipiente novo a cada aplicação', () => {
    const r = simularConsumoRecipientes(eventos, frasco, 'RECIPIENTE_INTEIRO');
    assert.equal(r.recipientesAbertos, 6);
    assert.equal(r.quantidadeDesperdicada, 22.5);
    aproximado(r.custoTotal, 6 * 9.8);
  });

  it('RECIPIENTE_INTEIRO usa várias ampolas quando a dose excede uma', () => {
    const r = simularConsumoRecipientes([{ hora: 0, quantidade: 5.04 }], { capacidade: 2, precoCusto: 4.9 }, 'RECIPIENTE_INTEIRO');
    assert.equal(r.recipientesAbertos, 3);
    aproximado(r.quantidadeDesperdicada, 0.96);
  });

  it('POR_ESTABILIDADE reaproveita o saldo até vencer e descarta o vencido', () => {
    const r = simularConsumoRecipientes(eventos, frasco, 'POR_ESTABILIDADE');
    // h0 abre F1 (vence 24) · h12 usa 3,75 de F1 + abre F2 (vence 36) · h24 usa F2 ·
    // h36 F2 venceu: descarta 1,25 e abre F3 · h48 abre F4 · alta: sobra 1,25 descartada.
    assert.deepEqual(r.horasAbertura, [0, 12, 36, 48]);
    assert.equal(r.recipientesAbertos, 4);
    aproximado(r.quantidadeDesperdicada, 2.5);
    aproximado(r.custoTotal, 4 * 9.8);
  });

  it('POR_ESTABILIDADE sem validade só descarta a sobra da alta', () => {
    const r = simularConsumoRecipientes(eventos, { capacidade: 10, precoCusto: 9.8 }, 'POR_ESTABILIDADE');
    assert.equal(r.recipientesAbertos, 4);
    aproximado(r.quantidadeDesperdicada, 2.5);
  });

  it('custo = recipientes abertos × preço (políticas não fracionadas)', () => {
    for (const politica of ['RECIPIENTE_INTEIRO', 'POR_ESTABILIDADE'] as const) {
      const r = simularConsumoRecipientes(eventos, frasco, politica);
      aproximado(r.custoUtilizado + r.custoDesperdicio, r.recipientesAbertos * frasco.precoCusto);
    }
  });
});

describe('medicamentos — dose', () => {
  const rx = (valor: number, unidade: Extract<Prescricao, { dose: unknown }>['dose']['unidade']) =>
    ({ medicamentoId: 'x', via: 'IV', frequencia: 'SID', dose: { valor, unidade } }) as const;

  it('mg/kg: peso × dose ÷ concentração', () => {
    const d = calcularDoseIntermitente(rx(25, 'mg/kg'), med('dipirona-amp-2ml'), 25);
    assert.equal(d.ativo, 625);
    assert.equal(d.quantidadeBase, 1.25);
  });

  it('converte mcg/kg para concentração em mg', () => {
    const d = calcularDoseIntermitente(rx(200, 'mcg/kg'), med('metadona-amp-1ml'), 3.5);
    aproximado(d.ativo, 0.7);
    aproximado(d.quantidadeBase, 0.07);
  });

  it('mL/kg e dose fixa em mL', () => {
    assert.equal(calcularDoseIntermitente(rx(0.1, 'mL/kg'), med('dipirona-amp-2ml'), 10).quantidadeBase, 1);
    assert.equal(calcularDoseIntermitente(rx(1.5, 'mL'), med('dipirona-amp-2ml'), 10).ativo, 750);
  });

  it('rejeita unidades incompatíveis', () => {
    assert.throws(() => calcularDoseIntermitente(rx(10, 'UI/kg'), med('dipirona-amp-2ml'), 10), erroComCodigo('UNIDADE_INCOMPATIVEL'));
    assert.throws(() => calcularDoseIntermitente(rx(1, 'comprimido'), med('dipirona-amp-2ml'), 10), erroComCodigo('UNIDADE_INCOMPATIVEL'));
  });

  it('rejeita dose não positiva', () => {
    assert.throws(() => calcularDoseIntermitente(rx(0, 'mg/kg'), med('dipirona-amp-2ml'), 10), erroComCodigo('VALOR_INVALIDO'));
  });

  it('taxa de CRI: mcg/kg/min é convertida para /h', () => {
    const t = calcularTaxaHorariaCRI({ valor: 0.05, unidade: 'mcg/kg/min' }, med('fentanil-amp-2ml'), 10);
    aproximado(t.ativoPorHora, 30);
    aproximado(t.quantidadePorHora, 0.6);
  });
});

describe('medicamentos — linha do tempo e custo', () => {
  it('frequências: SID=24 h, BID=12 h, TID=8 h, QID=6 h', () => {
    const esperado = { SID: 3, BID: 6, TID: 9, QID: 12, Q4H: 18, Q2H: 36 } as const;
    for (const [frequencia, n] of Object.entries(esperado)) {
      const r = calcularMedicamento(
        { medicamentoId: 'dipirona-amp-2ml', via: 'IV', frequencia: frequencia as keyof typeof esperado, dose: { valor: 25, unidade: 'mg/kg' } },
        med('dipirona-amp-2ml'),
        ctxMed(25),
      );
      assert.equal(r.linha.numeroAplicacoes, n, frequencia);
    }
  });

  it('respeita início, duração do tratamento e intervalo personalizado', () => {
    const r = calcularMedicamento(
      { medicamentoId: 'dipirona-amp-2ml', via: 'IV', frequencia: { intervaloHoras: 10 }, dose: { valor: 25, unidade: 'mg/kg' }, inicioHora: 30, duracaoHoras: 100 },
      med('dipirona-amp-2ml'),
      ctxMed(25),
    );
    assert.deepEqual(r.linha.horariosAplicacao, [30, 40, 50, 60, 70]);
  });

  it('dose única', () => {
    const r = calcularMedicamento(
      { medicamentoId: 'dipirona-amp-2ml', via: 'IV', frequencia: 'DOSE_UNICA', dose: { valor: 25, unidade: 'mg/kg' }, inicioHora: 5 },
      med('dipirona-amp-2ml'),
      ctxMed(25),
    );
    assert.deepEqual(r.linha.horariosAplicacao, [5]);
  });

  it('rejeita prescrição que começa após a alta', () => {
    assert.throws(
      () =>
        calcularMedicamento(
          { medicamentoId: 'dipirona-amp-2ml', via: 'IV', frequencia: 'SID', dose: { valor: 25, unidade: 'mg/kg' }, inicioHora: 72 },
          med('dipirona-amp-2ml'),
          ctxMed(25),
        ),
      erroComCodigo('JANELA_INVALIDA'),
    );
  });

  it('prescrição sobrescreve a política do medicamento', () => {
    const base = { medicamentoId: 'dipirona-amp-2ml', via: 'IV', frequencia: 'TID', dose: { valor: 25, unidade: 'mg/kg' } } as const;
    const inteiro = calcularMedicamento(base, med('dipirona-amp-2ml'), ctxMed(25));
    const fracionado = calcularMedicamento({ ...base, politicaDesperdicio: 'FRACIONADO' }, med('dipirona-amp-2ml'), ctxMed(25));
    assert.equal(inteiro.linha.custoTotal, 10.8); // 9 ampolas × R$ 1,20
    assert.equal(fracionado.linha.custoTotal, 6.75); // 11,25 mL × R$ 0,60/mL
  });

  it('CRI: preparos a cada 24 h, último preparo proporcional', () => {
    const rx: Prescricao = {
      medicamentoId: 'fentanil-amp-2ml',
      via: 'IV',
      frequencia: 'CRI',
      taxa: { valor: 3, unidade: 'mcg/kg/h' },
      renovacaoHoras: 24,
      duracaoHoras: 60,
      equipamentoId: 'bomba-seringa',
      insumosPorAplicacao: [{ insumoId: 'seringa-20ml', quantidade: 1 }],
    };
    const r = calcularMedicamento(rx, med('fentanil-amp-2ml'), ctxMed(3.5));
    // 3 mcg/kg/h × 3,5 kg = 10,5 mcg/h = 0,21 mL/h → preparos de 5,04 + 5,04 + 2,52 mL → 3 + 3 + 2 ampolas
    assert.deepEqual(r.linha.horariosAplicacao, [0, 24, 48]);
    assert.equal(r.linha.recipientesAbertos, 8);
    aproximado(r.linha.quantidadeTotalUtilizada, 12.6);
    assert.deepEqual(r.usoEquipamentos, [{ equipamentoId: 'bomba-seringa', horas: 60, origem: med('fentanil-amp-2ml').nome }]);
    assert.equal(r.consumoInsumos.find((c) => c.insumoId === 'seringa-20ml')?.quantidade, 3);
    // CRI não usa seringa automática
    assert.equal(r.consumoInsumos.some((c) => c.insumoId === 'agulha-25x7'), false);
  });

  it('seringa automática escolhe a menor que comporta a dose', () => {
    assert.equal(selecionarSeringa(0.07, seringas).seringa.id, 'seringa-1ml');
    assert.equal(selecionarSeringa(1, seringas).seringa.id, 'seringa-1ml');
    assert.equal(selecionarSeringa(6.25, seringas).seringa.id, 'seringa-10ml');
    assert.deepEqual(
      (({ seringa, quantidade }) => ({ id: seringa.id, quantidade }))(selecionarSeringa(45, seringas)),
      { id: 'seringa-20ml', quantidade: 3 },
    );
  });

  it('diluente acompanha os frascos abertos', () => {
    const r = calcularMedicamento(
      { medicamentoId: 'ceftriaxona-1g', via: 'IV', frequencia: 'BID', dose: { valor: 25, unidade: 'mg/kg' } },
      med('ceftriaxona-1g'),
      ctxMed(25),
    );
    assert.equal(r.linha.politicaDesperdicio, 'POR_ESTABILIDADE');
    assert.equal(r.consumoInsumos.find((c) => c.insumoId === 'agua-injecao-10ml')?.quantidade, 4);
  });

  it('alertas: microdose, desperdício, dose fora da faixa e controlado', () => {
    const r = calcularMedicamento(
      { medicamentoId: 'metadona-amp-1ml', via: 'IV', frequencia: 'QID', dose: { valor: 0.5, unidade: 'mg/kg' } },
      med('metadona-amp-1ml'),
      ctxMed(1, 72, { especie: 'GATO' }),
    );
    const codigos = r.alertas.map((a) => a.codigo).sort();
    assert.deepEqual(codigos, ['CONTROLADO', 'DESPERDICIO_ELEVADO', 'DOSE_FORA_DA_FAIXA', 'MICRODOSE']);
  });
});

describe('fluidoterapia', () => {
  const rx = {
    solucaoInsumoId: 'ringer-1000ml',
    taxaManutencaoMlKgH: 2,
    equipoInsumoId: 'equipo-macro',
  };

  it('manutenção + déficit + perdas, bolsas por validade', () => {
    const r = calcularFluidoterapia(
      { ...rx, deficitDesidratacaoPct: 6, perdasContinuasMlDia: 300, bombaInfusaoId: 'bomba-infusao' },
      insumo('ringer-1000ml'),
      { pesoKg: 25, duracaoInternacaoHoras: 72 },
    );
    assert.equal(r.linha.volumeManutencaoMl, 3600);
    assert.equal(r.linha.volumeDeficitMl, 1500);
    assert.equal(r.linha.volumePerdasMl, 900);
    assert.equal(r.linha.volumeTotalMl, 6000);
    assert.equal(r.linha.bolsasConsumidas, 6);
    assert.equal(r.linha.volumeDesperdicadoMl, 0);
    assert.equal(r.consumoInsumos[0]?.quantidade, 1); // 1 equipo em 72 h
    assert.equal(r.usoEquipamentos[0]?.horas, 72);
  });

  it('bolsa vencida (24 h) é descartada mesmo com saldo', () => {
    const r = calcularFluidoterapia({ ...rx, solucaoInsumoId: 'ringer-250ml', deficitDesidratacaoPct: 5 }, insumo('ringer-250ml'), {
      pesoKg: 3.5,
      duracaoInternacaoHoras: 72,
    });
    assert.equal(r.linha.volumeTotalMl, 679);
    assert.deepEqual(r.horasTrocaBolsa, [0, 17, 41, 65]);
    assert.equal(r.linha.volumeDesperdicadoMl, 321);
  });

  it('déficit parcialmente reposto quando a internação é menor que o tempo de correção', () => {
    const r = calcularFluidoterapia({ ...rx, deficitDesidratacaoPct: 8, horasCorrecaoDeficit: 24 }, insumo('ringer-1000ml'), {
      pesoKg: 10,
      duracaoInternacaoHoras: 12,
    });
    assert.equal(r.linha.volumeDeficitMl, 400); // 800 mL em 24 h → metade em 12 h
    assert.equal(r.linha.volumeTotalMl, 640);
  });

  it('exige capacidade na bolsa', () => {
    assert.throws(
      () => calcularFluidoterapia(rx, insumo('cateter-20g'), { pesoKg: 10, duracaoInternacaoHoras: 24 }),
      erroComCodigo('CADASTRO_INCOMPLETO'),
    );
  });
});

describe('insumos', () => {
  const ctx: ContextoInsumos = { horas: 60, dias: 3, pesoKg: 12, manejos: 15, aplicacoes: 20, coletas: 2 };

  it('cada tipo de regra', () => {
    assert.equal(calcularQuantidadeRegra({ tipo: 'FIXO', quantidade: 1 }, ctx).quantidade, 1);
    assert.equal(calcularQuantidadeRegra({ tipo: 'POR_DIA', quantidadePorDia: 2 }, ctx).quantidade, 6);
    assert.equal(calcularQuantidadeRegra({ tipo: 'POR_TROCA', trocaACadaHoras: 24 }, ctx).quantidade, 3);
    assert.equal(calcularQuantidadeRegra({ tipo: 'POR_TROCA', trocaACadaHoras: 72, quantidadePorTroca: 2 }, ctx).quantidade, 2);
    assert.equal(calcularQuantidadeRegra({ tipo: 'POR_MANEJO', quantidadePorManejo: 1 }, ctx).quantidade, 15);
    assert.equal(calcularQuantidadeRegra({ tipo: 'POR_APLICACAO', quantidadePorAplicacao: 1 }, ctx).quantidade, 20);
    assert.equal(calcularQuantidadeRegra({ tipo: 'POR_COLETA', quantidadePorColeta: 2 }, ctx).quantidade, 4);
    const faixas = [{ pesoMaxKg: 40, quantidadePorDia: 4 }, { pesoMaxKg: 10, quantidadePorDia: 2 }, { pesoMaxKg: 15, quantidadePorDia: 3 }];
    assert.equal(calcularQuantidadeRegra({ tipo: 'POR_FAIXA_PESO_DIA', faixas }, ctx).quantidade, 9);
    assert.throws(
      () => calcularQuantidadeRegra({ tipo: 'POR_FAIXA_PESO_DIA', faixas: [{ pesoMaxKg: 5, quantidadePorDia: 1 }] }, ctx),
      erroComCodigo('FAIXA_PESO_NAO_COBERTA'),
    );
  });

  it('itens inteiros arredondam para cima; fracionáveis não', () => {
    const consumo = { insumoId: '', quantidade: 2.3, origem: 'teste', memoria: '' };
    assert.equal(valorizarConsumo({ ...consumo, insumoId: 'cateter-20g' }, insumo('cateter-20g')).quantidade, 3);
    const fita = valorizarConsumo({ ...consumo, insumoId: 'fita-micropore' }, insumo('fita-micropore'));
    assert.equal(fita.quantidade, 2.3);
    assert.equal(fita.custoTotal, 0.03);
  });

  it('manejos: horários coincidentes contam uma vez', () => {
    // Rotina 6/6 h em 24 h: 0, 6, 12, 18. Medicação 0, 8, 16 → +8, +16.
    assert.equal(contarManejos([0, 8, 16, 0, 12], 24, 6), 6);
  });
});

describe('custos operacionais', () => {
  it('depreciação + manutenção por hora de uso', () => {
    const eq = catalogo.equipamentos.find((e) => e.id === 'bomba-infusao')!;
    aproximado(custoHoraEquipamento(eq), (5850 / 5 + 600) / (8760 * 0.5));
  });

  it('custo-base do leito considera ociosidade', () => {
    const { custoHora, totalMensal } = custoBaseLeitoHora(clinica);
    assert.equal(totalMensal, 29000);
    aproximado(custoHora, 29000 / (12 * 720 * 0.7));
  });

  it('custo-hora de profissional com encargos', () => {
    assert.equal(custoHoraProfissional({ salarioMensal: 2200, encargosPct: 100, horasMensais: 220 }), 20);
  });
});

describe('comercial', () => {
  it('SOBRE_CUSTO: lucro = custo × margem; impostos e taxa sobre o preço', () => {
    const r = calcularPrecoVenda(1000, 10, 5, 30, 'SOBRE_CUSTO');
    assert.equal(r.precoFinal, 1529.41); // 1000 × 1,30 ÷ 0,85
    assert.equal(r.impostos, 152.94);
    assert.equal(r.taxaPagamento, 76.47);
    assert.equal(r.lucro, 300);
  });

  it('SOBRE_PRECO: lucro = preço × margem', () => {
    const r = calcularPrecoVenda(1000, 10, 5, 20, 'SOBRE_PRECO');
    assert.equal(r.precoFinal, 1538.46); // 1000 ÷ 0,65
    assert.ok(Math.abs(r.lucro - r.precoFinal * 0.2) <= 0.02);
  });

  it('preço fecha exatamente: custo + lucro + impostos + taxa', () => {
    for (const custo of [0.01, 99.99, 1234.56, 98765.43]) {
      const r = calcularPrecoVenda(custo, 9.8, 5.39, 35, 'SOBRE_CUSTO');
      assert.equal(somarDinheiro([custo, r.lucro, r.impostos, r.taxaPagamento]), r.precoFinal);
    }
  });

  it('rejeita percentuais que somam 100% ou mais', () => {
    assert.throws(() => calcularPrecoVenda(100, 60, 40, 10, 'SOBRE_CUSTO'), erroComCodigo('PERCENTUAIS_INVIAVEIS'));
    assert.throws(() => calcularPrecoVenda(100, 50, 10, 40, 'SOBRE_PRECO'), erroComCodigo('PERCENTUAIS_INVIAVEIS'));
  });

  it('taxas por forma de pagamento', () => {
    const tabela = { pixPct: 0.5, debitoPct: 1.5, creditoPorParcelasPct: { 1: 3, 3: 5 } };
    assert.equal(taxaDaFormaPagamento({ tipo: 'DINHEIRO' }, tabela), 0);
    assert.equal(taxaDaFormaPagamento({ tipo: 'PIX' }, tabela), 0.5);
    assert.equal(taxaDaFormaPagamento({ tipo: 'CREDITO', parcelas: 3 }, tabela), 5);
    assert.throws(() => taxaDaFormaPagamento({ tipo: 'CREDITO', parcelas: 2 }, tabela), erroComCodigo('PARCELAMENTO_INDISPONIVEL'));
  });

  it('parcelas somam exatamente o preço', () => {
    const tabela = gerarTabelaFormasPagamento(1202.69, {
      margemLucroPct: 35,
      impostos: [{ nome: 'Simples', aliquotaPct: 9.8 }],
      formaPagamento: { tipo: 'PIX' },
      taxasPagamento: { debitoPct: 1.49, creditoPorParcelasPct: { 1: 3.15, 3: 5.39, 6: 7.49 } },
    });
    for (const p of tabela) {
      assert.equal(somarDinheiro([p.valorPrimeiraParcela, ...Array(p.parcelas - 1).fill(p.valorParcela)]), p.precoFinal);
    }
  });
});
