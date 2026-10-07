/**
 * Utilitários numéricos. Toda comparação "teto" usa uma tolerância para que erros de ponto
 * flutuante (ex.: 0,1 + 0,2 = 0,30000000000000004) não gerem um recipiente a mais.
 */

export const EPSILON = 1e-9;

/** Teto tolerante a ponto flutuante: tetoSeguro(3.0000000001) === 3. */
export function tetoSeguro(x: number): number {
  return Math.ceil(x - EPSILON);
}

/** Arredondamento half-up com `casas` decimais. */
export function arredondar(x: number, casas = 6): number {
  const fator = 10 ** casas;
  return Math.round((x + Math.sign(x) * Number.EPSILON) * fator) / fator;
}

/** Arredonda para cima ao múltiplo de `passo` (graduação de seringa, fração de comprimido). */
export function arredondarParaCimaMultiplo(x: number, passo: number): number {
  if (passo <= 0) return x;
  return arredondar(tetoSeguro(arredondar(x / passo, 9)) * passo);
}

export function paraCentavos(reais: number): number {
  return Math.round(arredondar(reais * 100, 6));
}

export function deCentavos(centavos: number): number {
  return centavos / 100;
}

/** Arredonda um valor monetário a centavos. */
export function dinheiro(reais: number): number {
  return deCentavos(paraCentavos(reais));
}

/** Soma valores monetários em centavos inteiros (sem deriva de ponto flutuante). */
export function somarDinheiro(valores: readonly number[]): number {
  return deCentavos(valores.reduce((acc, v) => acc + paraCentavos(v), 0));
}

export function pct(valorPct: number): number {
  return valorPct / 100;
}

const formatadorBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatadorNum = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

export const brl = (v: number): string => formatadorBRL.format(v);
export const num = (v: number): string => formatadorNum.format(v);
