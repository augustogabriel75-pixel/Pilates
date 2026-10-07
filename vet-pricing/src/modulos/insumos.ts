/**
 * Módulo de insumos: converte regras de consumo (fixo, por dia, por troca, por manejo, por
 * aplicação, por coleta, por faixa de peso) em quantidades e as valoriza ao custo do estoque.
 */
import { ErroCalculo, exigir, exigirNaoNegativo, exigirPositivo } from '../erros';
import type { Insumo, InsumoPrevisto, LinhaInsumo, RegraConsumo } from '../tipos';
import { EPSILON, arredondar, dinheiro, num, somarDinheiro, tetoSeguro } from '../util/numeros';
import type { ConsumoInsumoOrigem } from './medicamentos';

export interface ContextoInsumos {
  horas: number;
  /** Dias iniciados de internação: ⌈horas ÷ 24⌉. */
  dias: number;
  pesoKg: number;
  manejos: number;
  aplicacoes: number;
  coletas: number;
}

export function calcularQuantidadeRegra(regra: RegraConsumo, ctx: ContextoInsumos): { quantidade: number; memoria: string } {
  switch (regra.tipo) {
    case 'FIXO':
      exigirNaoNegativo(regra.quantidade, 'regra.quantidade');
      return { quantidade: regra.quantidade, memoria: `${num(regra.quantidade)} fixo(s) por internação` };
    case 'POR_DIA':
      exigirNaoNegativo(regra.quantidadePorDia, 'regra.quantidadePorDia');
      return { quantidade: regra.quantidadePorDia * ctx.dias, memoria: `${num(regra.quantidadePorDia)}/dia × ${ctx.dias} dia(s)` };
    case 'POR_TROCA': {
      exigirPositivo(regra.trocaACadaHoras, 'regra.trocaACadaHoras');
      const porTroca = regra.quantidadePorTroca ?? 1;
      const trocas = tetoSeguro(ctx.horas / regra.trocaACadaHoras);
      return {
        quantidade: trocas * porTroca,
        memoria: `⌈${num(ctx.horas)} h ÷ troca a cada ${num(regra.trocaACadaHoras)} h⌉ = ${trocas} troca(s) × ${num(porTroca)}`,
      };
    }
    case 'POR_MANEJO':
      exigirNaoNegativo(regra.quantidadePorManejo, 'regra.quantidadePorManejo');
      return { quantidade: regra.quantidadePorManejo * ctx.manejos, memoria: `${num(regra.quantidadePorManejo)} × ${ctx.manejos} manejo(s)` };
    case 'POR_APLICACAO':
      exigirNaoNegativo(regra.quantidadePorAplicacao, 'regra.quantidadePorAplicacao');
      return {
        quantidade: regra.quantidadePorAplicacao * ctx.aplicacoes,
        memoria: `${num(regra.quantidadePorAplicacao)} × ${ctx.aplicacoes} aplicação(ões)`,
      };
    case 'POR_COLETA':
      exigirNaoNegativo(regra.quantidadePorColeta, 'regra.quantidadePorColeta');
      return { quantidade: regra.quantidadePorColeta * ctx.coletas, memoria: `${num(regra.quantidadePorColeta)} × ${ctx.coletas} coleta(s)` };
    case 'POR_FAIXA_PESO_DIA': {
      exigir(regra.faixas.length > 0, 'VALOR_INVALIDO', 'regra POR_FAIXA_PESO_DIA sem faixas.', 'regra.faixas');
      const faixa = [...regra.faixas].sort((a, b) => a.pesoMaxKg - b.pesoMaxKg).find((f) => ctx.pesoKg <= f.pesoMaxKg + EPSILON);
      exigir(faixa, 'FAIXA_PESO_NAO_COBERTA', `Nenhuma faixa cobre ${ctx.pesoKg} kg (use pesoMaxKg alto na última faixa).`, 'regra.faixas');
      return {
        quantidade: faixa.quantidadePorDia * ctx.dias,
        memoria: `Faixa ≤ ${num(faixa.pesoMaxKg)} kg: ${num(faixa.quantidadePorDia)}/dia × ${ctx.dias} dia(s)`,
      };
    }
    default: {
      const desconhecida: never = regra;
      throw new ErroCalculo('REGRA_INVALIDA', `Regra de consumo desconhecida: ${JSON.stringify(desconhecida)}`, 'insumos.regra');
    }
  }
}

/** Converte os insumos previstos (regras) em pedidos de consumo. */
export function expandirInsumosPrevistos(previstos: readonly InsumoPrevisto[], ctx: ContextoInsumos): ConsumoInsumoOrigem[] {
  return previstos.map((p) => {
    const { quantidade, memoria } = calcularQuantidadeRegra(p.regra, ctx);
    const perda = p.perdaPrevistaUnidades ?? 0;
    exigirNaoNegativo(perda, `insumos[${p.insumoId}].perdaPrevistaUnidades`);
    return {
      insumoId: p.insumoId,
      quantidade: quantidade + perda,
      origem: p.observacao ?? `Regra: ${p.regra.tipo}`,
      memoria: perda > 0 ? `${memoria} + ${num(perda)} reserva p/ perda` : memoria,
    };
  });
}

/** Valoriza um pedido de consumo. Itens não fracionáveis são arredondados para cima. */
export function valorizarConsumo(consumo: ConsumoInsumoOrigem, insumo: Insumo): LinhaInsumo {
  exigirNaoNegativo(insumo.custoUnitario, `insumo[${insumo.id}].custoUnitario`);
  const quantidade = insumo.fracionavel ? arredondar(consumo.quantidade, 4) : tetoSeguro(consumo.quantidade);
  const arredondou = !insumo.fracionavel && quantidade !== arredondar(consumo.quantidade, 6);
  return {
    insumoId: insumo.id,
    nome: insumo.nome,
    categoria: insumo.categoria,
    origem: consumo.origem,
    quantidade,
    unidade: insumo.unidade,
    custoUnitario: insumo.custoUnitario,
    custoTotal: dinheiro(quantidade * insumo.custoUnitario),
    memoriaCalculo: arredondou ? `${consumo.memoria} = ${num(consumo.quantidade)} → ${quantidade} (inteiro)` : consumo.memoria,
  };
}

/** Soma por insumo, para reserva/baixa de estoque. */
export function consolidarInsumos(linhas: readonly LinhaInsumo[]): {
  insumoId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custoTotal: number;
}[] {
  const mapa = new Map<string, { insumoId: string; nome: string; quantidade: number; unidade: string; custos: number[] }>();
  for (const l of linhas) {
    const atual = mapa.get(l.insumoId) ?? { insumoId: l.insumoId, nome: l.nome, quantidade: 0, unidade: l.unidade, custos: [] };
    atual.quantidade = arredondar(atual.quantidade + l.quantidade, 4);
    atual.custos.push(l.custoTotal);
    mapa.set(l.insumoId, atual);
  }
  return [...mapa.values()].map(({ custos, ...resto }) => ({ ...resto, custoTotal: somarDinheiro(custos) }));
}

/**
 * Manejos = horários distintos em que o paciente é manipulado: aplicações/preparos de
 * medicamentos, trocas de bolsa e rotina de aferição (a cada `intervaloRotinaHoras`).
 * Medicações no mesmo horário contam como um único manejo.
 */
export function contarManejos(horariosEventos: readonly number[], duracaoHoras: number, intervaloRotinaHoras: number): number {
  exigirPositivo(intervaloRotinaHoras, 'categoria.intervaloManejoRotinaHoras');
  const chaves = new Set<number>();
  for (const h of horariosEventos) chaves.add(arredondar(h, 3));
  for (let h = 0; h < duracaoHoras - EPSILON; h += intervaloRotinaHoras) chaves.add(arredondar(h, 3));
  return chaves.size;
}
