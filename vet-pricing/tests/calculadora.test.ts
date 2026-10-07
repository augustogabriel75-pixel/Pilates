import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { entradaCao25kg, entradaGato3_5kg } from '../examples/dados-exemplo';
import { calculateHospitalizationCost, paraInternacaoOrcamento } from '../src/calculadora';
import { ErroCalculo } from '../src/erros';
import { combinarProtocolos } from '../src/modulos/protocolos';
import type { EntradaCalculo, ProtocoloTratamento, ResultadoCalculo } from '../src/tipos';
import { somarDinheiro } from '../src/util/numeros';

const erroComCodigo = (codigo: string) => (e: unknown) => e instanceof ErroCalculo && e.codigo === codigo;
const medicamento = (r: ResultadoCalculo, id: string) => r.medicamentos.find((m) => m.medicamentoId === id)!;
const consolidado = (r: ResultadoCalculo, id: string) => r.insumosConsolidados.find((i) => i.insumoId === id);

/** Invariantes contábeis que valem para qualquer entrada válida. */
function verificarInvariantes(r: ResultadoCalculo): void {
  const s = r.resumo;
  assert.equal(s.custoMedicamentos, somarDinheiro(r.medicamentos.map((m) => m.custoTotal)));
  assert.equal(s.custoInsumos, somarDinheiro(r.insumos.map((i) => i.custoTotal)));
  assert.equal(s.custoInsumos, somarDinheiro(r.insumosConsolidados.map((i) => i.custoTotal)));
  assert.equal(s.custoDireto, somarDinheiro([s.custoMedicamentos, s.custoFluidoterapia, s.custoInsumos, s.margemSeguranca.total]));
  assert.equal(s.custoIndireto, somarDinheiro([s.custoLeito, s.custoEquipamentos, s.custoMaoDeObra]));
  assert.equal(s.custoTotal, somarDinheiro([s.custoDireto, s.custoIndireto]));
  assert.equal(s.precoFinal, somarDinheiro([s.custoTotal, s.lucro, s.impostos, s.taxaPagamento]));
  for (const m of r.medicamentos) assert.equal(m.custoTotal, somarDinheiro([m.custoUtilizado, m.custoDesperdicio]));
  const formaAtual = r.tabelaFormasPagamento.find((p) => p.taxaPct === s.taxaPagamentoPct);
  assert.equal(formaAtual?.precoFinal, s.precoFinal);
}

describe('Cenário 1 — cão 25 kg, internação geral, 72 h', () => {
  const r = calculateHospitalizationCost(entradaCao25kg);

  it('invariantes contábeis', () => verificarInvariantes(r));

  it('dipirona: 625 mg = 1,25 mL TID → 9 ampolas de 2 mL', () => {
    const m = medicamento(r, 'dipirona-amp-2ml');
    assert.equal(m.doseAtivoPorAplicacao.valor, 625);
    assert.equal(m.quantidadePorAplicacao, 1.25);
    assert.equal(m.recipientesAbertos, 9);
    assert.equal(m.quantidadeDesperdicada, 6.75);
    assert.equal(m.custoTotal, 10.8);
  });

  it('ceftriaxona: 4 frascos pela estabilidade de 24 h', () => {
    const m = medicamento(r, 'ceftriaxona-1g');
    assert.equal(m.recipientesAbertos, 4);
    assert.equal(m.custoTotal, 39.2);
  });

  it('maropitant fracionado: 7,5 mL cobrados', () => {
    const m = medicamento(r, 'maropitant-20ml');
    assert.equal(m.quantidadeTotalUtilizada, 7.5);
    assert.equal(m.custoTotal, 106.88);
  });

  it('fluidoterapia: 6 L em 6 bolsas de 1 L', () => {
    assert.equal(r.fluidoterapia?.volumeTotalMl, 6000);
    assert.equal(r.fluidoterapia?.bolsasConsumidas, 6);
  });

  it('insumos: 4 cateteres, 18 manejos, 12 tapetes', () => {
    assert.equal(consolidado(r, 'cateter-20g')?.quantidade, 4);
    assert.equal(r.manejosPrevistos, 18);
    assert.equal(consolidado(r, 'luva-par')?.quantidade, 18);
    assert.equal(consolidado(r, 'tapete-higienico')?.quantidade, 12);
    // 9 dipirona + 3 maropitant (3 mL) + 3 coletas; 6 ceftriaxona (10 mL)
    assert.equal(consolidado(r, 'seringa-3ml')?.quantidade, 15);
    assert.equal(consolidado(r, 'seringa-10ml')?.quantidade, 6);
  });

  it('valores de referência (regressão)', () => {
    assert.equal(r.resumo.custoDireto, 302.45);
    assert.equal(r.resumo.custoIndireto, 900.24);
    assert.equal(r.resumo.custoTotal, 1202.69);
    assert.equal(r.resumo.precoFinal, 1914.43);
    assert.equal(r.resumo.precoDiaria, 638.14);
  });

  it('não emite alertas para prescrição dentro das faixas', () => {
    assert.deepEqual(r.alertas, []);
  });
});

describe('Cenário 2 — gato 3,5 kg, semi-intensiva, microdoses', () => {
  const r = calculateHospitalizationCost(entradaGato3_5kg);

  it('invariantes contábeis', () => verificarInvariantes(r));

  it('metadona: 0,07 mL por dose, 12 ampolas inteiras descartadas', () => {
    const m = medicamento(r, 'metadona-amp-1ml');
    assert.equal(m.quantidadePorAplicacao, 0.07);
    assert.equal(m.recipientesAbertos, 12);
    assert.equal(m.custoTotal, 78);
    assert.equal(m.custoDesperdicio, 72.54);
  });

  it('ondansetrona: 0,875 mL arredondado à graduação (0,88 mL)', () => {
    assert.equal(medicamento(r, 'ondansetrona-amp-2ml').quantidadePorAplicacao, 0.88);
  });

  it('seringas de 1 mL para todas as microdoses', () => {
    assert.equal(consolidado(r, 'seringa-1ml')?.quantidade, 12 + 9 + 3 + 2);
  });

  it('inclui monitor multiparamétrico do leito semi-intensivo', () => {
    assert.ok(r.operacional.equipamentos.some((e) => e.descricao.startsWith('Monitor multiparamétrico')));
  });

  it('alerta microdose e desperdício', () => {
    const codigos = r.alertas.map((a) => a.codigo);
    assert.ok(codigos.includes('MICRODOSE'));
    assert.equal(codigos.filter((c) => c === 'DESPERDICIO_ELEVADO').length, 2);
  });

  it('cobrar apenas a fração reduz o custo de medicamentos', () => {
    const fracionado = calculateHospitalizationCost({
      ...entradaGato3_5kg,
      prescricoes: entradaGato3_5kg.prescricoes.map((rx) => ({ ...rx, politicaDesperdicio: 'FRACIONADO' as const })),
    });
    assert.ok(fracionado.resumo.custoMedicamentos < r.resumo.custoMedicamentos);
    assert.equal(fracionado.alertas.some((a) => a.codigo === 'DESPERDICIO_ELEVADO'), false);
  });

  it('valores de referência (regressão)', () => {
    assert.equal(r.resumo.custoTotal, 1652.22);
    assert.equal(r.resumo.precoFinal, 2629.99);
  });
});

describe('calculateHospitalizationCost — comportamento geral', () => {
  it('é pura: não altera a entrada e é determinística', () => {
    const copia = structuredClone(entradaCao25kg);
    const a = calculateHospitalizationCost(entradaCao25kg);
    const b = calculateHospitalizationCost(entradaCao25kg);
    assert.deepEqual(entradaCao25kg, copia);
    assert.deepEqual(a, b);
  });

  it('margem de segurança é aplicada por grupo', () => {
    const sem = calculateHospitalizationCost({ ...entradaCao25kg, margemSeguranca: { medicamentosPct: 0, insumosPct: 0, fluidoterapiaPct: 0 } });
    const com = calculateHospitalizationCost(entradaCao25kg);
    assert.equal(sem.resumo.margemSeguranca.total, 0);
    assert.ok(sem.alertas.some((a) => a.codigo === 'SEM_MARGEM_SEGURANCA'));
    assert.equal(com.resumo.margemSeguranca.insumos, Math.round(com.resumo.custoInsumos * 10) / 100);
    assert.ok(com.resumo.precoFinal > sem.resumo.precoFinal);
  });

  it('UTI custa mais que internação geral para a mesma prescrição', () => {
    const uti = calculateHospitalizationCost({ ...entradaCao25kg, internacao: { ...entradaCao25kg.internacao, categoriaLeito: 'UTI' } });
    const geral = calculateHospitalizationCost(entradaCao25kg);
    assert.ok(uti.resumo.custoIndireto > geral.resumo.custoIndireto);
    assert.ok(uti.manejosPrevistos > geral.manejosPrevistos); // rotina 2/2 h
  });

  it('PIX é mais barato que crédito parcelado', () => {
    const r = calculateHospitalizationCost(entradaCao25kg);
    const pix = r.tabelaFormasPagamento.find((p) => p.tipo === 'PIX')!;
    assert.ok(pix.precoFinal < r.resumo.precoFinal);
  });

  it('internação de horas fracionadas', () => {
    const r = calculateHospitalizationCost({ ...entradaCao25kg, internacao: { ...entradaCao25kg.internacao, duracaoHoras: 30 } });
    verificarInvariantes(r);
    assert.equal(r.dias, 2);
    assert.equal(r.resumo.precoDiaria, Math.round((r.resumo.precoFinal / 1.25) * 100) / 100);
  });

  it('invariantes valem para 300 combinações pseudoaleatórias', () => {
    let semente = 20261007;
    const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const escolher = <T,>(itens: readonly T[]): T => itens[Math.floor(aleatorio() * itens.length)]!;
    const politicas = ['FRACIONADO', 'RECIPIENTE_INTEIRO', 'POR_ESTABILIDADE', undefined] as const;
    const formas = [{ tipo: 'PIX' }, { tipo: 'DEBITO' }, { tipo: 'CREDITO', parcelas: 1 }, { tipo: 'CREDITO', parcelas: 6 }] as const;

    for (let i = 0; i < 300; i++) {
      const base = aleatorio() < 0.5 ? entradaCao25kg : entradaGato3_5kg;
      const r = calculateHospitalizationCost({
        ...base,
        paciente: { ...base.paciente, pesoKg: Math.round((0.5 + aleatorio() * 40) * 100) / 100 },
        internacao: {
          ...base.internacao,
          duracaoHoras: Math.round((1 + aleatorio() * 167) * 4) / 4,
          categoriaLeito: escolher(['GERAL', 'SEMI_INTENSIVA', 'UTI'] as const),
        },
        prescricoes: base.prescricoes.map((rx) => ({ ...rx, politicaDesperdicio: escolher(politicas) })),
        comercial: { ...base.comercial, margemLucroPct: Math.round(aleatorio() * 80), formaPagamento: escolher(formas) },
      });
      verificarInvariantes(r);
      for (const m of r.medicamentos) assert.ok(m.quantidadeDesperdicada >= 0 && m.custoDesperdicio >= 0);
    }
  });

  it('peso atípico gera alerta crítico (provável g × kg)', () => {
    const r = calculateHospitalizationCost({ ...entradaGato3_5kg, paciente: { ...entradaGato3_5kg.paciente, pesoKg: 35 } });
    assert.ok(r.alertas.some((a) => a.codigo === 'PESO_ATIPICO' && a.nivel === 'CRITICO'));
  });

  describe('validação', () => {
    const casos: [string, (e: EntradaCalculo) => EntradaCalculo, string][] = [
      ['peso zero', (e) => ({ ...e, paciente: { ...e.paciente, pesoKg: 0 } }), 'VALOR_INVALIDO'],
      ['duração negativa', (e) => ({ ...e, internacao: { ...e.internacao, duracaoHoras: -1 } }), 'VALOR_INVALIDO'],
      ['medicamento inexistente', (e) => ({ ...e, prescricoes: [{ ...e.prescricoes[0]!, medicamentoId: 'nao-existe' }] }), 'REFERENCIA_INEXISTENTE'],
      ['insumo inexistente', (e) => ({ ...e, insumos: [{ insumoId: 'nao-existe', regra: { tipo: 'FIXO', quantidade: 1 } }] }), 'REFERENCIA_INEXISTENTE'],
      ['categoria não configurada', (e) => ({ ...e, internacao: { ...e.internacao, categoriaLeito: 'ISOLAMENTO' } }), 'CATEGORIA_NAO_CONFIGURADA'],
      ['prescrição duplicada', (e) => ({ ...e, prescricoes: [e.prescricoes[0]!, e.prescricoes[0]!] }), 'ID_DUPLICADO'],
      ['impostos inviáveis', (e) => ({ ...e, comercial: { ...e.comercial, impostos: [{ nome: 'x', aliquotaPct: 95 }] } }), 'PERCENTUAIS_INVIAVEIS'],
      ['ocupação zero', (e) => ({ ...e, clinica: { ...e.clinica, taxaOcupacaoMedia: 0 } }), 'VALOR_INVALIDO'],
    ];
    for (const [nome, alterar, codigo] of casos) {
      it(nome, () => assert.throws(() => calculateHospitalizationCost(alterar(entradaCao25kg)), erroComCodigo(codigo)));
    }
  });
});

describe('protocolos e persistência', () => {
  const acessoVenoso: ProtocoloTratamento = {
    id: 'acesso-venoso',
    nome: 'Acesso venoso periférico',
    indicacao: 'Suporte',
    prescricoes: [],
    insumos: entradaCao25kg.insumos.slice(0, 5),
  };
  const gastroenterite: ProtocoloTratamento = {
    id: 'gastro-cao',
    nome: 'Gastroenterite canina',
    indicacao: 'Gastroenterite aguda',
    especies: ['CAO'],
    prescricoes: entradaCao25kg.prescricoes,
    fluidoterapia: entradaCao25kg.fluidoterapia!,
    insumos: entradaCao25kg.insumos.slice(5),
  };

  it('combinar protocolos reproduz a entrada manual', () => {
    const itens = combinarProtocolos([acessoVenoso, gastroenterite], 'CAO');
    const r = calculateHospitalizationCost({ ...entradaCao25kg, ...itens });
    assert.equal(r.resumo.precoFinal, calculateHospitalizationCost(entradaCao25kg).resumo.precoFinal);
  });

  it('bloqueia protocolo de outra espécie', () => {
    assert.throws(() => combinarProtocolos([gastroenterite], 'GATO'), erroComCodigo('PROTOCOLO_INCOMPATIVEL'));
  });

  it('mapeia para InternacaoOrcamento', () => {
    const r = calculateHospitalizationCost(entradaCao25kg);
    const o = paraInternacaoOrcamento('orc-1', entradaCao25kg, r, { criadoEm: '2026-10-07T12:00:00Z' });
    assert.equal(o.pacienteId, 'pac-thor');
    assert.equal(o.precoSugeridoTotal, r.resumo.precoFinal);
    assert.equal(o.custosFixosCalculados, r.resumo.custoIndireto);
    assert.equal(o.status, 'RASCUNHO');
    assert.equal(o.listaMedicacoes.length, 3);
  });
});
