import type { Especie, FrequenciaPadrao, UnidadeBase } from './tipos';

export const VERSAO_ALGORITMO = '1.0.0';

/**
 * Intervalo entre aplicações. Nomenclatura clássica:
 * SID (semel in die) = 1×/dia, BID = 2×/dia, TID = 3×/dia, QID = 4×/dia.
 */
export const INTERVALO_FREQUENCIA_HORAS: Readonly<Record<FrequenciaPadrao, number>> = {
  SID: 24,
  BID: 12,
  TID: 8,
  QID: 6,
  Q4H: 4,
  Q2H: 2,
};

export const RESOLUCAO_MEDIDA_PADRAO: Readonly<Record<UnidadeBase, number>> = {
  mL: 0.01,
  comprimido: 0.25,
};

export const LIMITE_MICRODOSE_ML_PADRAO = 0.1;
export const RENOVACAO_CRI_HORAS_PADRAO = 24;
export const VALIDADE_BOLSA_FLUIDO_HORAS_PADRAO = 24;
export const TROCA_EQUIPO_HORAS_PADRAO = 72;
export const HORAS_CORRECAO_DEFICIT_PADRAO = 24;
/** Passo da simulação de consumo contínuo de fluido (h). */
export const PASSO_SIMULACAO_FLUIDO_HORAS = 1;
export const HORAS_ANO = 8760;

/** Faixas plausíveis de peso por espécie — servem para detectar erro de digitação (g × kg). */
export const FAIXA_PESO_PLAUSIVEL_KG: Readonly<Record<Especie, { min: number; max: number }>> = {
  CAO: { min: 0.3, max: 110 },
  GATO: { min: 0.3, max: 15 },
  EQUINO: { min: 30, max: 1300 },
  BOVINO: { min: 20, max: 1500 },
  EXOTICO: { min: 0.005, max: 300 },
};

/** A partir desta fração do custo do item em desperdício, emite alerta. */
export const LIMIAR_ALERTA_DESPERDICIO = 0.5;
