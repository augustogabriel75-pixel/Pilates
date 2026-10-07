/**
 * API pública do motor de precificação de internação veterinária.
 * Sem dependências de runtime: pode ser importado por uma rota de API (Next.js, Express,
 * Fastify), por um worker ou diretamente no frontend para simulação em tempo real.
 */
export { calculateHospitalizationCost, paraInternacaoOrcamento } from './calculadora';
export { ErroCalculo } from './erros';
export * from './constantes';
export * from './tipos';

export { simularConsumoRecipientes, type EventoConsumo, type Recipiente, type ResultadoRecipientes } from './modulos/recipientes';
export { calcularMedicamento, calcularDoseIntermitente, calcularTaxaHorariaCRI, selecionarSeringa, intervaloDaFrequencia } from './modulos/medicamentos';
export { calcularFluidoterapia } from './modulos/fluidoterapia';
export { calcularQuantidadeRegra, contarManejos } from './modulos/insumos';
export { custoHoraEquipamento, custoBaseLeitoHora, custoHoraProfissional } from './modulos/operacional';
export { calcularPrecoVenda, gerarTabelaFormasPagamento, taxaDaFormaPagamento } from './modulos/comercial';
export { combinarProtocolos } from './modulos/protocolos';
