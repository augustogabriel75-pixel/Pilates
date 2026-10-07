/**
 * Tipagens do domínio de precificação de internação veterinária.
 *
 * Convenções:
 *  - Valores monetários de ENTRADA em reais (number). Valores monetários de SAÍDA em reais
 *    arredondados a centavos (2 casas); somatórios são feitos em centavos inteiros para
 *    que total = soma das linhas, sem divergência de 1 centavo.
 *  - Percentuais sempre em pontos percentuais (ex.: 9.5 = 9,5%), exceto taxas de
 *    ocupação/utilização, que são frações 0–1.
 *  - Tempo sempre em HORAS, contado a partir da admissão (hora 0).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Cadastros básicos
// ─────────────────────────────────────────────────────────────────────────────

export type Especie = 'CAO' | 'GATO' | 'EQUINO' | 'BOVINO' | 'EXOTICO';

export type CategoriaLeito = 'GERAL' | 'SEMI_INTENSIVA' | 'UTI' | 'ISOLAMENTO';

export interface Tutor {
  id: string;
  nome: string;
  documento?: string;
  telefone?: string;
}

export interface Paciente {
  id: string;
  nome: string;
  especie: Especie;
  pesoKg: number;
  tutorId: string;
  raca?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Medicamentos
// ─────────────────────────────────────────────────────────────────────────────

/** Unidade física em que o medicamento é medido, aspirado e administrado. */
export type UnidadeBase = 'mL' | 'comprimido';

/** Unidade do princípio ativo na concentração (ex.: 500 mg por mL). */
export type UnidadeAtivo = 'mg' | 'mcg' | 'UI';

export type TipoRecipiente =
  | 'AMPOLA'
  | 'FRASCO_AMPOLA'
  | 'FRASCO'
  | 'BOLSA'
  | 'BLISTER'
  | 'SERINGA_PREENCHIDA';

/**
 * Como a sobra do recipiente é tratada no custo:
 *  - FRACIONADO: cobra apenas a fração usada (frasco multidose compartilhado entre pacientes).
 *  - RECIPIENTE_INTEIRO: cada aplicação abre recipientes novos e a sobra é descartada
 *    (ampolas de uso único, fármacos sem conservante).
 *  - POR_ESTABILIDADE: frasco dedicado ao paciente; a sobra é reaproveitada entre aplicações
 *    enquanto estiver dentro da validade pós-abertura/reconstituição. Ao vencer, ou na alta,
 *    o saldo é descartado e cobrado.
 */
export type PoliticaDesperdicio = 'FRACIONADO' | 'RECIPIENTE_INTEIRO' | 'POR_ESTABILIDADE';

export interface ApresentacaoComercial {
  tipoRecipiente: TipoRecipiente;
  unidadeBase: UnidadeBase;
  /** Conteúdo de um recipiente na unidade base (ex.: 2 para ampola de 2 mL). */
  quantidadePorRecipiente: number;
  /**
   * Menor fração mensurável na prática (graduação da seringa, fracionamento do comprimido).
   * Doses são arredondadas PARA CIMA a esse passo. Padrão: 0,01 mL / 0,25 comprimido.
   */
  resolucaoMedida?: number;
}

/** Concentração do ativo por unidade base (mg/mL, mcg/mL, UI/mL, mg/comprimido...). */
export interface Concentracao {
  valor: number;
  unidade: UnidadeAtivo;
}

export interface FaixaDose {
  min: number;
  max: number;
  unidade: UnidadeDose;
}

export interface Medicamento {
  id: string;
  nome: string;
  principioAtivo: string;
  apresentacao: ApresentacaoComercial;
  concentracao: Concentracao;
  /** Preço de custo de UM recipiente (ampola, frasco, comprimido), vindo do estoque. */
  precoCustoRecipiente: number;
  /** Ampola/recipiente que não pode ser reaberto: sobra sempre descartada. */
  usoUnico?: boolean;
  /** Validade após aberto/reconstituído, em horas. `null`/ausente = não vence durante a internação. */
  validadeAposAbertoHoras?: number | null;
  /** Política padrão do item (a prescrição pode sobrescrever). */
  politicaDesperdicioPadrao?: PoliticaDesperdicio;
  /** Insumos consumidos a cada recipiente aberto (ex.: diluente para reconstituição). */
  insumosPorRecipienteAberto?: ConsumoInsumo[];
  /** Faixas de referência por espécie, usadas apenas para ALERTAS (nunca bloqueiam o cálculo). */
  faixaDoseReferencia?: Partial<Record<Especie, FaixaDose>>;
  controlado?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Insumos e equipamentos
// ─────────────────────────────────────────────────────────────────────────────

export type CategoriaInsumo =
  | 'CATETER'
  | 'EQUIPO'
  | 'EXTENSOR'
  | 'TORNEIRA'
  | 'FIXACAO'
  | 'ANTISSEPSIA'
  | 'SERINGA'
  | 'AGULHA'
  | 'HIGIENE'
  | 'LUVA'
  | 'CONFORTO'
  | 'FLUIDO'
  | 'DILUENTE'
  | 'COLETA'
  | 'OUTROS';

export interface Insumo {
  id: string;
  nome: string;
  categoria: CategoriaInsumo;
  /** Unidade de consumo (un, par, cm, mL...). `custoUnitario` refere-se a ela. */
  unidade: string;
  custoUnitario: number;
  /** Se `false` (padrão), quantidades fracionárias são arredondadas para cima. */
  fracionavel?: boolean;
  /** Capacidade em mL — usada para auto-seleção de seringas e para bolsas de fluido. */
  capacidadeMl?: number;
  /** Validade após aberto (bolsas de fluido). Padrão para bolsas: 24 h. */
  validadeAposAbertoHoras?: number;
}

export interface Equipamento {
  id: string;
  nome: string;
  valorAquisicao: number;
  valorResidual: number;
  vidaUtilAnos: number;
  manutencaoAnual: number;
  /** Fração do tempo em que o equipamento efetivamente está em uso (0–1). */
  taxaUtilizacao: number;
}

/** Consumo direto de um insumo (quantidade já conhecida). */
export interface ConsumoInsumo {
  insumoId: string;
  quantidade: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prescrições
// ─────────────────────────────────────────────────────────────────────────────

/** Frequências padronizadas. SID = 24/24 h, BID = 12/12 h, TID = 8/8 h, QID = 6/6 h. */
export type FrequenciaPadrao = 'SID' | 'BID' | 'TID' | 'QID' | 'Q4H' | 'Q2H';
export type Frequencia = FrequenciaPadrao | 'DOSE_UNICA' | { intervaloHoras: number };

/** Dose por aplicação. Com "/kg" a dose é multiplicada pelo peso. */
export type UnidadeDose =
  | 'mg/kg'
  | 'mcg/kg'
  | 'UI/kg'
  | 'mL/kg'
  | 'mg'
  | 'mcg'
  | 'UI'
  | 'mL'
  | 'comprimido';

/** Taxa de infusão contínua (CRI). */
export type UnidadeTaxaCRI = 'mg/kg/h' | 'mcg/kg/h' | 'mcg/kg/min' | 'mL/kg/h' | 'mL/h';

export type ViaAdministracao = 'IV' | 'IM' | 'SC' | 'VO' | 'TOPICA' | 'INALATORIA' | 'OUTRA';

interface PrescricaoBase {
  id?: string;
  medicamentoId: string;
  via: ViaAdministracao;
  /** Hora de início relativa à admissão. Padrão: 0. */
  inicioHora?: number;
  /** Duração do tratamento. Padrão: até a alta. */
  duracaoHoras?: number;
  politicaDesperdicio?: PoliticaDesperdicio;
  /** Insumos consumidos a cada aplicação (ou a cada preparo de CRI). */
  insumosPorAplicacao?: ConsumoInsumo[];
  /** Equipamento ocupado durante o tratamento (ex.: bomba de seringa em CRI). */
  equipamentoId?: string;
}

export interface PrescricaoIntermitente extends PrescricaoBase {
  frequencia: Frequencia;
  dose: { valor: number; unidade: UnidadeDose };
  /**
   * Seleciona automaticamente a menor seringa do catálogo da clínica que comporte a dose,
   * mais a agulha padrão. Padrão: `true` para vias IV/IM/SC em medicamentos medidos em mL.
   */
  seringaAutomatica?: boolean;
}

export interface PrescricaoCRI extends PrescricaoBase {
  frequencia: 'CRI';
  taxa: { valor: number; unidade: UnidadeTaxaCRI };
  /** A solução é preparada novamente a cada N horas (estabilidade da diluição). Padrão: 24. */
  renovacaoHoras?: number;
}

export type Prescricao = PrescricaoIntermitente | PrescricaoCRI;

export interface PrescricaoFluidoterapia {
  /** Insumo da categoria FLUIDO (bolsa de soro) com `capacidadeMl`. */
  solucaoInsumoId: string;
  /** Taxa de manutenção em mL/kg/h. */
  taxaManutencaoMlKgH: number;
  /** % de desidratação estimada; déficit (mL) = % × peso(kg) × 10. */
  deficitDesidratacaoPct?: number;
  /** Horas para repor o déficit. Padrão: 24. */
  horasCorrecaoDeficit?: number;
  /** Perdas contínuas estimadas (vômito, diarreia, poliúria), mL/dia. */
  perdasContinuasMlDia?: number;
  inicioHora?: number;
  duracaoHoras?: number;
  equipoInsumoId: string;
  /** Troca do equipo a cada N horas. Padrão: 72. */
  trocaEquipoHoras?: number;
  /** Bomba de infusão (equipamento) ocupada durante a fluidoterapia. */
  bombaInfusaoId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Regras de consumo de insumos
// ─────────────────────────────────────────────────────────────────────────────

export type RegraConsumo =
  /** Quantidade fixa por internação (ex.: colar elizabetano). */
  | { tipo: 'FIXO'; quantidade: number }
  /** Por dia iniciado de internação. */
  | { tipo: 'POR_DIA'; quantidadePorDia: number }
  /** Troca programada a cada N horas (cateter, extensor, torneirinha). */
  | { tipo: 'POR_TROCA'; trocaACadaHoras: number; quantidadePorTroca?: number }
  /** Por manejo do paciente (luvas). Manejos = horários distintos de medicação + rotina. */
  | { tipo: 'POR_MANEJO'; quantidadePorManejo: number }
  /** Por aplicação de qualquer medicamento (algodão, álcool). */
  | { tipo: 'POR_APLICACAO'; quantidadePorAplicacao: number }
  /** Por coleta de exame prevista. */
  | { tipo: 'POR_COLETA'; quantidadePorColeta: number }
  /** Por dia, conforme faixa de peso (tapetes/fraldas). */
  | { tipo: 'POR_FAIXA_PESO_DIA'; faixas: { pesoMaxKg: number; quantidadePorDia: number }[] };

export interface InsumoPrevisto {
  insumoId: string;
  regra: RegraConsumo;
  /** Unidades extras previstas para perdas/trocas acidentais (ex.: cateter obstruído). */
  perdaPrevistaUnidades?: number;
  observacao?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Protocolos
// ─────────────────────────────────────────────────────────────────────────────

export interface ProtocoloTratamento {
  id: string;
  nome: string;
  indicacao: string;
  especies?: Especie[];
  categoriaLeitoSugerida?: CategoriaLeito;
  prescricoes: Prescricao[];
  fluidoterapia?: PrescricaoFluidoterapia;
  insumos: InsumoPrevisto[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuração da clínica (custos fixos, leitos, equipe)
// ─────────────────────────────────────────────────────────────────────────────

export interface Profissional {
  id: string;
  funcao: string;
  /** Custo total por hora (salário + encargos + benefícios, ou valor do plantão / horas). */
  custoHora: number;
}

export interface ConfigCategoriaLeito {
  /** Peso relativo de consumo de estrutura (Geral = 1,0; UTI consome mais área, energia, limpeza). */
  fatorPonderacaoEstrutura: number;
  /** Equipamentos alocados ao leito; `fracaoUso` = parcela do equipamento por leito (0–1). */
  equipamentos: { equipamentoId: string; fracaoUso: number }[];
  /** Dimensionamento da equipe: 1 profissional atende N pacientes simultaneamente. */
  equipe: { profissionalId: string; pacientesPorProfissional: number }[];
  /** Intervalo da rotina de manejo/aferição de parâmetros (h). */
  intervaloManejoRotinaHoras: number;
}

export interface ConfiguracaoClinica {
  custosFixosMensais: { descricao: string; valor: number }[];
  /** Horas de funcionamento da internação no mês (24 h × 30 = 720). */
  horasOperacionaisMes: number;
  totalLeitos: number;
  /** Ocupação média dos leitos (0–1): o custo da ociosidade é rateado entre os leitos ocupados. */
  taxaOcupacaoMedia: number;
  categorias: Partial<Record<CategoriaLeito, ConfigCategoriaLeito>>;
  profissionais: Profissional[];
  /** IDs de insumos SERINGA (com `capacidadeMl`) para auto-seleção. */
  catalogoSeringas?: string[];
  agulhaPadraoInsumoId?: string;
  politicaDesperdicioPadrao?: PoliticaDesperdicio;
  /** Volume abaixo do qual a dose é sinalizada como microdose. Padrão: 0,1 mL. */
  limiteMicrodoseMl?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parâmetros comerciais
// ─────────────────────────────────────────────────────────────────────────────

export type TipoPagamento = 'PIX' | 'DINHEIRO' | 'DEBITO' | 'CREDITO';

export interface FormaPagamento {
  tipo: TipoPagamento;
  /** Apenas para CREDITO. Padrão: 1. */
  parcelas?: number;
}

export interface TabelaTaxasPagamento {
  pixPct?: number;
  debitoPct: number;
  /** Taxa (MDR + antecipação) por número de parcelas: { 1: 3.1, 2: 4.5, ... }. */
  creditoPorParcelasPct: Record<number, number>;
}

/**
 * - SOBRE_CUSTO (markup): lucro = custo × margem. Preço = custo × (1 + m) ÷ (1 − impostos − taxa).
 * - SOBRE_PRECO (margem líquida): lucro = preço × margem. Preço = custo ÷ (1 − impostos − taxa − m).
 */
export type ModoMargem = 'SOBRE_CUSTO' | 'SOBRE_PRECO';

export interface ParametrosComerciais {
  margemLucroPct: number;
  modoMargem?: ModoMargem;
  /** Tributos sobre a receita (Simples Nacional — alíquota efetiva, ISS, PIS/COFINS...). */
  impostos: { nome: string; aliquotaPct: number }[];
  formaPagamento: FormaPagamento;
  taxasPagamento: TabelaTaxasPagamento;
}

/** Fator de segurança para imprevistos (cateter obstruído, seringa contaminada, dose repetida). */
export interface MargemSeguranca {
  medicamentosPct: number;
  insumosPct: number;
  fluidoterapiaPct?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrada do cálculo
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogoEstoque {
  medicamentos: Medicamento[];
  insumos: Insumo[];
  equipamentos: Equipamento[];
}

export interface EntradaCalculo {
  paciente: Paciente;
  internacao: {
    duracaoHoras: number;
    categoriaLeito: CategoriaLeito;
    coletasExamesPrevistas?: number;
  };
  prescricoes: Prescricao[];
  fluidoterapia?: PrescricaoFluidoterapia;
  insumos: InsumoPrevisto[];
  margemSeguranca: MargemSeguranca;
  catalogo: CatalogoEstoque;
  clinica: ConfiguracaoClinica;
  comercial: ParametrosComerciais;
}

// ─────────────────────────────────────────────────────────────────────────────
// Saída do cálculo
// ─────────────────────────────────────────────────────────────────────────────

export interface LinhaMedicamento {
  prescricaoId?: string;
  medicamentoId: string;
  nome: string;
  principioAtivo: string;
  via: ViaAdministracao;
  frequencia: string;
  politicaDesperdicio: PoliticaDesperdicio;
  /** Dose de ativo por aplicação (CRI: por preparo). */
  doseAtivoPorAplicacao: { valor: number; unidade: UnidadeAtivo };
  /** Volume/quantidade por aplicação, já arredondado à resolução de medida. */
  quantidadePorAplicacao: number;
  unidadeBase: UnidadeBase;
  numeroAplicacoes: number;
  horariosAplicacao: number[];
  quantidadeTotalUtilizada: number;
  quantidadeDesperdicada: number;
  recipientesAbertos: number;
  custoPorUnidadeBase: number;
  custoUtilizado: number;
  custoDesperdicio: number;
  custoTotal: number;
  memoriaCalculo: string[];
}

export interface LinhaFluidoterapia {
  solucaoInsumoId: string;
  nome: string;
  taxaManutencaoMlH: number;
  volumeManutencaoMl: number;
  volumeDeficitMl: number;
  volumePerdasMl: number;
  volumeTotalMl: number;
  volumeMedioDiarioMl: number;
  capacidadeBolsaMl: number;
  bolsasConsumidas: number;
  volumeDesperdicadoMl: number;
  custoUtilizado: number;
  custoDesperdicio: number;
  custoTotal: number;
  memoriaCalculo: string[];
}

export interface LinhaInsumo {
  insumoId: string;
  nome: string;
  categoria: CategoriaInsumo;
  origem: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number;
  custoTotal: number;
  memoriaCalculo: string;
}

export interface LinhaCustoOperacional {
  descricao: string;
  horas: number;
  custoHora: number;
  custoTotal: number;
  memoriaCalculo: string;
}

export interface PrecoPorFormaPagamento {
  tipo: TipoPagamento;
  parcelas: number;
  taxaPct: number;
  precoFinal: number;
  /** Valor das parcelas 2..n (truncado ao centavo). */
  valorParcela: number;
  /** A 1ª parcela absorve os centavos restantes: 1ª + (n − 1) × valorParcela = precoFinal. */
  valorPrimeiraParcela: number;
}

export interface ResumoFinanceiro {
  custoMedicamentos: number;
  custoFluidoterapia: number;
  custoInsumos: number;
  margemSeguranca: { medicamentos: number; fluidoterapia: number; insumos: number; total: number };
  /** Medicamentos + fluidoterapia + insumos + margem de segurança. */
  custoDireto: number;
  custoLeito: number;
  custoEquipamentos: number;
  custoMaoDeObra: number;
  /** Leito (rateio de custos fixos) + equipamentos + mão de obra. */
  custoIndireto: number;
  custoTotal: number;
  custoPorDia: number;
  lucro: number;
  impostos: number;
  taxaPagamento: number;
  precoFinal: number;
  precoDiaria: number;
  aliquotaImpostosPct: number;
  taxaPagamentoPct: number;
  /** Lucro ÷ preço final. */
  margemLiquidaSobrePrecoPct: number;
  /** (Preço final ÷ custo total − 1). */
  markupSobreCustoPct: number;
}

export type NivelAlerta = 'INFO' | 'ATENCAO' | 'CRITICO';

export interface Alerta {
  nivel: NivelAlerta;
  codigo: string;
  mensagem: string;
}

export interface ResultadoCalculo {
  versaoAlgoritmo: string;
  paciente: { id: string; nome: string; especie: Especie; pesoKg: number };
  duracaoHoras: number;
  dias: number;
  categoriaLeito: CategoriaLeito;
  medicamentos: LinhaMedicamento[];
  fluidoterapia: LinhaFluidoterapia | null;
  insumos: LinhaInsumo[];
  /** Insumos somados por item, para reserva/baixa de estoque. */
  insumosConsolidados: { insumoId: string; nome: string; quantidade: number; unidade: string; custoTotal: number }[];
  operacional: {
    leito: LinhaCustoOperacional;
    equipamentos: LinhaCustoOperacional[];
    maoDeObra: LinhaCustoOperacional[];
  };
  manejosPrevistos: number;
  resumo: ResumoFinanceiro;
  tabelaFormasPagamento: PrecoPorFormaPagamento[];
  alertas: Alerta[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Entidade persistida
// ─────────────────────────────────────────────────────────────────────────────

export type StatusOrcamento = 'RASCUNHO' | 'ENVIADO' | 'APROVADO' | 'RECUSADO' | 'CONVERTIDO';

export interface InternacaoOrcamento {
  id: string;
  pacienteId: string;
  duracaoHoras: number;
  categoriaLeito: CategoriaLeito;
  listaMedicacoes: LinhaMedicamento[];
  listaInsumos: LinhaInsumo[];
  fluidoterapia: LinhaFluidoterapia | null;
  custoDireto: number;
  custosFixosCalculados: number;
  custoTotal: number;
  margemLucroPct: number;
  impostosPct: number;
  taxaPagamentoPct: number;
  precoSugeridoTotal: number;
  precoSugeridoDiaria: number;
  status: StatusOrcamento;
  versaoAlgoritmo: string;
  criadoEm: string;
  /** Resultado integral, para auditoria e reimpressão sem recálculo. */
  snapshot: ResultadoCalculo;
}
