/**
 * Motor de consumo de recipientes (ampolas, frascos, bolsas).
 *
 * Recebe uma linha do tempo de consumos `{ hora, quantidade }` e devolve quantos recipientes
 * são abertos, quanto é aproveitado e quanto é descartado, conforme a política de desperdício.
 * É usado tanto para medicamentos (aplicações e preparos de CRI) quanto para bolsas de fluido.
 */
import type { PoliticaDesperdicio } from '../tipos';
import { EPSILON, arredondar, deCentavos, paraCentavos, tetoSeguro } from '../util/numeros';

export interface EventoConsumo {
  /** Hora do consumo, relativa à admissão. */
  hora: number;
  /** Quantidade na unidade base (mL, comprimido). */
  quantidade: number;
}

export interface Recipiente {
  capacidade: number;
  precoCusto: number;
  /** Validade após aberto (h). `null`/ausente = não vence. */
  validadeAposAbertoHoras?: number | null;
}

export interface ResultadoRecipientes {
  politica: PoliticaDesperdicio;
  /**
   * Recipientes abertos. Em FRACIONADO é apenas referência de estoque (o custo é proporcional);
   * nas demais políticas é exatamente o que é cobrado.
   */
  recipientesAbertos: number;
  /** Horas em que cada recipiente foi aberto (vazio em FRACIONADO). */
  horasAbertura: number[];
  quantidadeUtilizada: number;
  quantidadeDesperdicada: number;
  custoUtilizado: number;
  custoDesperdicio: number;
  custoTotal: number;
}

export function simularConsumoRecipientes(
  eventos: readonly EventoConsumo[],
  recipiente: Recipiente,
  politica: PoliticaDesperdicio,
): ResultadoRecipientes {
  const { capacidade, precoCusto } = recipiente;
  const custoPorUnidade = precoCusto / capacidade;
  const quantidadeUtilizada = arredondar(eventos.reduce((acc, e) => acc + e.quantidade, 0));

  if (politica === 'FRACIONADO') {
    return montar(politica, tetoSeguro(quantidadeUtilizada / capacidade), [], quantidadeUtilizada, 0, custoPorUnidade);
  }

  if (politica === 'RECIPIENTE_INTEIRO') {
    let abertos = 0;
    const horasAbertura: number[] = [];
    for (const e of eventos) {
      const n = tetoSeguro(e.quantidade / capacidade);
      abertos += n;
      for (let i = 0; i < n; i++) horasAbertura.push(e.hora);
    }
    return montar(politica, abertos, horasAbertura, quantidadeUtilizada, abertos * capacidade - quantidadeUtilizada, custoPorUnidade);
  }

  // POR_ESTABILIDADE: um recipiente aberto permanece em uso até esvaziar ou vencer.
  const validade = recipiente.validadeAposAbertoHoras ?? Number.POSITIVE_INFINITY;
  const ordenados = [...eventos].sort((a, b) => a.hora - b.hora);
  let saldo = 0;
  let venceEm = Number.NEGATIVE_INFINITY;
  let desperdicio = 0;
  const horasAbertura: number[] = [];

  for (const e of ordenados) {
    if (saldo > EPSILON && e.hora >= venceEm - EPSILON) {
      desperdicio += saldo; // venceu antes desta aplicação: descarta o saldo
      saldo = 0;
    }
    let necessario = e.quantidade;
    while (necessario > EPSILON) {
      if (saldo <= EPSILON) {
        saldo = capacidade;
        venceEm = e.hora + validade;
        horasAbertura.push(e.hora);
      }
      const usado = Math.min(saldo, necessario);
      saldo -= usado;
      necessario -= usado;
    }
  }
  if (saldo > EPSILON) desperdicio += saldo; // sobra na alta: frasco dedicado ao paciente

  return montar(politica, horasAbertura.length, horasAbertura, quantidadeUtilizada, desperdicio, custoPorUnidade);
}

function montar(
  politica: PoliticaDesperdicio,
  recipientesAbertos: number,
  horasAbertura: number[],
  quantidadeUtilizada: number,
  quantidadeDesperdicada: number,
  custoPorUnidade: number,
): ResultadoRecipientes {
  const desperdicio = Math.max(0, arredondar(quantidadeDesperdicada));
  const custoUtilizado = quantidadeUtilizada * custoPorUnidade;
  const custoDesperdicio = desperdicio * custoPorUnidade;
  return {
    politica,
    recipientesAbertos,
    horasAbertura,
    quantidadeUtilizada,
    quantidadeDesperdicada: desperdicio,
    custoUtilizado,
    custoDesperdicio,
    custoTotal: custoUtilizado + custoDesperdicio,
  };
}

/**
 * Custos arredondados a centavos de forma que utilizado + desperdício = total exatamente
 * (arredondar as duas parcelas isoladamente pode gerar 1 centavo de diferença).
 */
export function custosEmCentavos(r: ResultadoRecipientes): { custoUtilizado: number; custoDesperdicio: number; custoTotal: number } {
  const totalC = paraCentavos(r.custoTotal);
  const utilizadoC = Math.min(paraCentavos(r.custoUtilizado), totalC);
  return { custoUtilizado: deCentavos(utilizadoC), custoDesperdicio: deCentavos(totalC - utilizadoC), custoTotal: deCentavos(totalC) };
}
