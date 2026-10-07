/**
 * Catálogo, configuração da clínica e cenários de exemplo.
 *
 * Preços, salários e doses são ILUSTRATIVOS para demonstrar o cálculo. Em produção, os valores
 * vêm do estoque/financeiro da clínica e as doses, da prescrição do médico-veterinário.
 */
import { custoHoraProfissional } from '../src/modulos/operacional';
import type { CatalogoEstoque, ConfiguracaoClinica, EntradaCalculo, MargemSeguranca, ParametrosComerciais } from '../src/tipos';

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de estoque
// ─────────────────────────────────────────────────────────────────────────────

export const catalogo: CatalogoEstoque = {
  medicamentos: [
    {
      id: 'dipirona-amp-2ml',
      nome: 'Dipirona sódica 500 mg/mL — ampola 2 mL',
      principioAtivo: 'Dipirona sódica',
      apresentacao: { tipoRecipiente: 'AMPOLA', unidadeBase: 'mL', quantidadePorRecipiente: 2 },
      concentracao: { valor: 500, unidade: 'mg' },
      precoCustoRecipiente: 1.2,
      usoUnico: true,
      faixaDoseReferencia: { CAO: { min: 10, max: 25, unidade: 'mg/kg' } },
    },
    {
      id: 'ceftriaxona-1g',
      nome: 'Ceftriaxona 1 g — frasco-ampola (reconstituir em 10 mL)',
      principioAtivo: 'Ceftriaxona sódica',
      apresentacao: { tipoRecipiente: 'FRASCO_AMPOLA', unidadeBase: 'mL', quantidadePorRecipiente: 10 },
      concentracao: { valor: 100, unidade: 'mg' },
      precoCustoRecipiente: 9.8,
      validadeAposAbertoHoras: 24,
      insumosPorRecipienteAberto: [{ insumoId: 'agua-injecao-10ml', quantidade: 1 }],
    },
    {
      id: 'maropitant-20ml',
      nome: 'Maropitant 10 mg/mL — frasco multidose 20 mL',
      principioAtivo: 'Citrato de maropitant',
      apresentacao: { tipoRecipiente: 'FRASCO', unidadeBase: 'mL', quantidadePorRecipiente: 20 },
      concentracao: { valor: 10, unidade: 'mg' },
      precoCustoRecipiente: 285,
      // Frasco multidose compartilhado na internação: cobra-se só a fração usada.
      politicaDesperdicioPadrao: 'FRACIONADO',
      faixaDoseReferencia: {
        CAO: { min: 1, max: 1, unidade: 'mg/kg' },
        GATO: { min: 1, max: 1, unidade: 'mg/kg' },
      },
    },
    {
      id: 'metadona-amp-1ml',
      nome: 'Metadona 10 mg/mL — ampola 1 mL',
      principioAtivo: 'Cloridrato de metadona',
      apresentacao: { tipoRecipiente: 'AMPOLA', unidadeBase: 'mL', quantidadePorRecipiente: 1 },
      concentracao: { valor: 10, unidade: 'mg' },
      precoCustoRecipiente: 6.5,
      usoUnico: true,
      controlado: true,
      faixaDoseReferencia: { GATO: { min: 0.1, max: 0.3, unidade: 'mg/kg' } },
    },
    {
      id: 'ondansetrona-amp-2ml',
      nome: 'Ondansetrona 2 mg/mL — ampola 2 mL',
      principioAtivo: 'Cloridrato de ondansetrona',
      apresentacao: { tipoRecipiente: 'AMPOLA', unidadeBase: 'mL', quantidadePorRecipiente: 2 },
      concentracao: { valor: 2, unidade: 'mg' },
      precoCustoRecipiente: 2.4,
      usoUnico: true,
    },
    {
      id: 'fentanil-amp-2ml',
      nome: 'Fentanil 50 mcg/mL — ampola 2 mL',
      principioAtivo: 'Citrato de fentanila',
      apresentacao: { tipoRecipiente: 'AMPOLA', unidadeBase: 'mL', quantidadePorRecipiente: 2 },
      concentracao: { valor: 50, unidade: 'mcg' },
      precoCustoRecipiente: 4.9,
      usoUnico: true,
      controlado: true,
    },
  ],
  insumos: [
    { id: 'cateter-20g', nome: 'Cateter periférico 20G', categoria: 'CATETER', unidade: 'un', custoUnitario: 3.9 },
    { id: 'cateter-24g', nome: 'Cateter periférico 24G', categoria: 'CATETER', unidade: 'un', custoUnitario: 4.2 },
    { id: 'equipo-macro', nome: 'Equipo macrogotas', categoria: 'EQUIPO', unidade: 'un', custoUnitario: 3.2 },
    { id: 'equipo-micro', nome: 'Equipo microgotas', categoria: 'EQUIPO', unidade: 'un', custoUnitario: 4.1 },
    { id: 'extensor-2vias', nome: 'Extensor multivias (2 vias)', categoria: 'EXTENSOR', unidade: 'un', custoUnitario: 3.8 },
    { id: 'torneira-3vias', nome: 'Torneirinha de 3 vias', categoria: 'TORNEIRA', unidade: 'un', custoUnitario: 1.4 },
    { id: 'fita-micropore', nome: 'Fita microporosa 25 mm', categoria: 'FIXACAO', unidade: 'cm', custoUnitario: 0.012, fracionavel: true },
    { id: 'clorexidina-alc', nome: 'Clorexidina alcoólica 0,5%', categoria: 'ANTISSEPSIA', unidade: 'mL', custoUnitario: 0.03, fracionavel: true },
    { id: 'swab-alcool', nome: 'Swab de álcool 70%', categoria: 'ANTISSEPSIA', unidade: 'un', custoUnitario: 0.12 },
    { id: 'seringa-1ml', nome: 'Seringa 1 mL (insulina/tuberculina)', categoria: 'SERINGA', unidade: 'un', custoUnitario: 0.35, capacidadeMl: 1 },
    { id: 'seringa-3ml', nome: 'Seringa 3 mL', categoria: 'SERINGA', unidade: 'un', custoUnitario: 0.38, capacidadeMl: 3 },
    { id: 'seringa-5ml', nome: 'Seringa 5 mL', categoria: 'SERINGA', unidade: 'un', custoUnitario: 0.45, capacidadeMl: 5 },
    { id: 'seringa-10ml', nome: 'Seringa 10 mL', categoria: 'SERINGA', unidade: 'un', custoUnitario: 0.65, capacidadeMl: 10 },
    { id: 'seringa-20ml', nome: 'Seringa 20 mL', categoria: 'SERINGA', unidade: 'un', custoUnitario: 1.1, capacidadeMl: 20 },
    { id: 'agulha-25x7', nome: 'Agulha 25 × 7', categoria: 'AGULHA', unidade: 'un', custoUnitario: 0.15 },
    { id: 'luva-par', nome: 'Luvas de procedimento', categoria: 'LUVA', unidade: 'par', custoUnitario: 0.7 },
    { id: 'tapete-higienico', nome: 'Tapete higiênico 60 × 60', categoria: 'HIGIENE', unidade: 'un', custoUnitario: 1.6 },
    { id: 'agua-injecao-10ml', nome: 'Água para injeção 10 mL', categoria: 'DILUENTE', unidade: 'un', custoUnitario: 0.55 },
    { id: 'tubo-coleta', nome: 'Tubo de coleta (EDTA/soro)', categoria: 'COLETA', unidade: 'un', custoUnitario: 0.9 },
    { id: 'ringer-1000ml', nome: 'Ringer com lactato 1000 mL', categoria: 'FLUIDO', unidade: 'bolsa', custoUnitario: 7.9, capacidadeMl: 1000, validadeAposAbertoHoras: 24 },
    { id: 'ringer-250ml', nome: 'Ringer com lactato 250 mL', categoria: 'FLUIDO', unidade: 'bolsa', custoUnitario: 4.9, capacidadeMl: 250, validadeAposAbertoHoras: 24 },
  ],
  equipamentos: [
    { id: 'bomba-infusao', nome: 'Bomba de infusão volumétrica', valorAquisicao: 6500, valorResidual: 650, vidaUtilAnos: 5, manutencaoAnual: 600, taxaUtilizacao: 0.5 },
    { id: 'bomba-seringa', nome: 'Bomba de seringa', valorAquisicao: 5200, valorResidual: 520, vidaUtilAnos: 5, manutencaoAnual: 500, taxaUtilizacao: 0.4 },
    { id: 'monitor-multi', nome: 'Monitor multiparamétrico', valorAquisicao: 18000, valorResidual: 1800, vidaUtilAnos: 7, manutencaoAnual: 1200, taxaUtilizacao: 0.6 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Configuração da clínica
// ─────────────────────────────────────────────────────────────────────────────

export const clinica: ConfiguracaoClinica = {
  custosFixosMensais: [
    { descricao: 'Aluguel e condomínio', valor: 12000 },
    { descricao: 'Energia elétrica', valor: 4500 },
    { descricao: 'Água e esgoto', valor: 900 },
    { descricao: 'Internet e telefonia', valor: 400 },
    { descricao: 'Limpeza e lavanderia', valor: 2600 },
    { descricao: 'Administrativo e contabilidade', valor: 6800 },
    { descricao: 'Sistemas e licenças', valor: 600 },
    { descricao: 'Outros', valor: 1200 },
  ],
  horasOperacionaisMes: 720,
  totalLeitos: 12,
  taxaOcupacaoMedia: 0.7,
  profissionais: [
    {
      id: 'tecnico-enf',
      funcao: 'Técnico(a) de enfermagem veterinária',
      custoHora: custoHoraProfissional({ salarioMensal: 2900, encargosPct: 68, beneficiosMensais: 650, horasMensais: 220 }),
    },
    { id: 'vet-plantonista', funcao: 'Médico(a)-veterinário(a) plantonista', custoHora: 50 },
    { id: 'vet-intensivista', funcao: 'Médico(a)-veterinário(a) intensivista', custoHora: 75 },
  ],
  categorias: {
    GERAL: {
      fatorPonderacaoEstrutura: 1,
      equipamentos: [],
      equipe: [
        { profissionalId: 'tecnico-enf', pacientesPorProfissional: 8 },
        { profissionalId: 'vet-plantonista', pacientesPorProfissional: 12 },
      ],
      intervaloManejoRotinaHoras: 6,
    },
    SEMI_INTENSIVA: {
      fatorPonderacaoEstrutura: 1.4,
      equipamentos: [{ equipamentoId: 'monitor-multi', fracaoUso: 0.5 }],
      equipe: [
        { profissionalId: 'tecnico-enf', pacientesPorProfissional: 4 },
        { profissionalId: 'vet-plantonista', pacientesPorProfissional: 8 },
      ],
      intervaloManejoRotinaHoras: 4,
    },
    UTI: {
      fatorPonderacaoEstrutura: 2.2,
      equipamentos: [{ equipamentoId: 'monitor-multi', fracaoUso: 1 }],
      equipe: [
        { profissionalId: 'tecnico-enf', pacientesPorProfissional: 2 },
        { profissionalId: 'vet-intensivista', pacientesPorProfissional: 4 },
      ],
      intervaloManejoRotinaHoras: 2,
    },
  },
  catalogoSeringas: ['seringa-1ml', 'seringa-3ml', 'seringa-5ml', 'seringa-10ml', 'seringa-20ml'],
  agulhaPadraoInsumoId: 'agulha-25x7',
  politicaDesperdicioPadrao: 'FRACIONADO',
  limiteMicrodoseMl: 0.1,
};

export const comercial: ParametrosComerciais = {
  margemLucroPct: 35,
  modoMargem: 'SOBRE_CUSTO',
  impostos: [{ nome: 'Simples Nacional — alíquota efetiva (ISS incluso no DAS)', aliquotaPct: 9.8 }],
  formaPagamento: { tipo: 'CREDITO', parcelas: 3 },
  taxasPagamento: {
    pixPct: 0,
    debitoPct: 1.49,
    creditoPorParcelasPct: { 1: 3.15, 2: 4.69, 3: 5.39, 4: 6.09, 5: 6.79, 6: 7.49 },
  },
};

export const margemSeguranca: MargemSeguranca = { medicamentosPct: 5, insumosPct: 10, fluidoterapiaPct: 3 };

const base = { catalogo, clinica, comercial, margemSeguranca } as const;

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 1 — Cão, 25 kg, Internação Geral, 72 h, fluidoterapia + 3 injetáveis
// ─────────────────────────────────────────────────────────────────────────────

export const entradaCao25kg: EntradaCalculo = {
  ...base,
  paciente: { id: 'pac-thor', nome: 'Thor', especie: 'CAO', pesoKg: 25, tutorId: 'tutor-001', raca: 'SRD' },
  internacao: { duracaoHoras: 72, categoriaLeito: 'GERAL', coletasExamesPrevistas: 3 },
  prescricoes: [
    { id: 'rx-dipirona', medicamentoId: 'dipirona-amp-2ml', via: 'IV', frequencia: 'TID', dose: { valor: 25, unidade: 'mg/kg' } },
    { id: 'rx-ceftriaxona', medicamentoId: 'ceftriaxona-1g', via: 'IV', frequencia: 'BID', dose: { valor: 25, unidade: 'mg/kg' } },
    { id: 'rx-maropitant', medicamentoId: 'maropitant-20ml', via: 'SC', frequencia: 'SID', dose: { valor: 1, unidade: 'mg/kg' } },
  ],
  fluidoterapia: {
    solucaoInsumoId: 'ringer-1000ml',
    taxaManutencaoMlKgH: 2,
    deficitDesidratacaoPct: 6,
    horasCorrecaoDeficit: 24,
    perdasContinuasMlDia: 300,
    equipoInsumoId: 'equipo-macro',
    trocaEquipoHoras: 72,
    bombaInfusaoId: 'bomba-infusao',
  },
  insumos: [
    // 4 cateteres previstos: troca a cada 24 h (protocolo para paciente com vômito) + 1 reserva.
    { insumoId: 'cateter-20g', regra: { tipo: 'POR_TROCA', trocaACadaHoras: 24 }, perdaPrevistaUnidades: 1, observacao: 'Acesso venoso' },
    { insumoId: 'extensor-2vias', regra: { tipo: 'POR_TROCA', trocaACadaHoras: 72 }, observacao: 'Acesso venoso' },
    { insumoId: 'torneira-3vias', regra: { tipo: 'POR_TROCA', trocaACadaHoras: 72 }, observacao: 'Acesso venoso' },
    { insumoId: 'fita-micropore', regra: { tipo: 'POR_TROCA', trocaACadaHoras: 24, quantidadePorTroca: 40 }, perdaPrevistaUnidades: 40, observacao: 'Fixação do cateter' },
    { insumoId: 'clorexidina-alc', regra: { tipo: 'POR_TROCA', trocaACadaHoras: 24, quantidadePorTroca: 5 }, perdaPrevistaUnidades: 5, observacao: 'Antissepsia do acesso' },
    { insumoId: 'swab-alcool', regra: { tipo: 'POR_APLICACAO', quantidadePorAplicacao: 1 }, observacao: 'Antissepsia por aplicação' },
    { insumoId: 'luva-par', regra: { tipo: 'POR_MANEJO', quantidadePorManejo: 1 }, observacao: 'Manejo' },
    {
      insumoId: 'tapete-higienico',
      regra: { tipo: 'POR_FAIXA_PESO_DIA', faixas: [{ pesoMaxKg: 5, quantidadePorDia: 2 }, { pesoMaxKg: 15, quantidadePorDia: 3 }, { pesoMaxKg: 40, quantidadePorDia: 4 }, { pesoMaxKg: 9999, quantidadePorDia: 6 }] },
      observacao: 'Higiene',
    },
    { insumoId: 'seringa-3ml', regra: { tipo: 'POR_COLETA', quantidadePorColeta: 1 }, observacao: 'Coleta de exames' },
    { insumoId: 'agulha-25x7', regra: { tipo: 'POR_COLETA', quantidadePorColeta: 1 }, observacao: 'Coleta de exames' },
    { insumoId: 'tubo-coleta', regra: { tipo: 'POR_COLETA', quantidadePorColeta: 2 }, observacao: 'Coleta de exames' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 2 — Gato, 3,5 kg, Semi-intensiva, 72 h, microdoses + ampolas de uso único
// ─────────────────────────────────────────────────────────────────────────────

export const entradaGato3_5kg: EntradaCalculo = {
  ...base,
  paciente: { id: 'pac-mia', nome: 'Mia', especie: 'GATO', pesoKg: 3.5, tutorId: 'tutor-002', raca: 'SRD' },
  internacao: { duracaoHoras: 72, categoriaLeito: 'SEMI_INTENSIVA', coletasExamesPrevistas: 2 },
  prescricoes: [
    // 0,2 mg/kg × 3,5 kg = 0,7 mg = 0,07 mL de uma ampola de 1 mL: 93% descartado a cada dose.
    { id: 'rx-metadona', medicamentoId: 'metadona-amp-1ml', via: 'IV', frequencia: 'QID', dose: { valor: 0.2, unidade: 'mg/kg' } },
    { id: 'rx-ondansetrona', medicamentoId: 'ondansetrona-amp-2ml', via: 'IV', frequencia: 'TID', dose: { valor: 0.5, unidade: 'mg/kg' } },
    { id: 'rx-maropitant', medicamentoId: 'maropitant-20ml', via: 'SC', frequencia: 'SID', dose: { valor: 1, unidade: 'mg/kg' } },
  ],
  fluidoterapia: {
    solucaoInsumoId: 'ringer-250ml',
    taxaManutencaoMlKgH: 2,
    deficitDesidratacaoPct: 5,
    horasCorrecaoDeficit: 24,
    equipoInsumoId: 'equipo-micro',
    trocaEquipoHoras: 72,
    bombaInfusaoId: 'bomba-infusao',
  },
  insumos: [
    { insumoId: 'cateter-24g', regra: { tipo: 'POR_TROCA', trocaACadaHoras: 72 }, perdaPrevistaUnidades: 1, observacao: 'Acesso venoso' },
    { insumoId: 'extensor-2vias', regra: { tipo: 'POR_TROCA', trocaACadaHoras: 72 }, observacao: 'Acesso venoso' },
    { insumoId: 'torneira-3vias', regra: { tipo: 'POR_TROCA', trocaACadaHoras: 72 }, observacao: 'Acesso venoso' },
    { insumoId: 'fita-micropore', regra: { tipo: 'POR_TROCA', trocaACadaHoras: 24, quantidadePorTroca: 25 }, observacao: 'Fixação do cateter' },
    { insumoId: 'clorexidina-alc', regra: { tipo: 'POR_TROCA', trocaACadaHoras: 72, quantidadePorTroca: 3 }, perdaPrevistaUnidades: 3, observacao: 'Antissepsia do acesso' },
    { insumoId: 'swab-alcool', regra: { tipo: 'POR_APLICACAO', quantidadePorAplicacao: 1 }, observacao: 'Antissepsia por aplicação' },
    { insumoId: 'luva-par', regra: { tipo: 'POR_MANEJO', quantidadePorManejo: 1 }, observacao: 'Manejo' },
    {
      insumoId: 'tapete-higienico',
      regra: { tipo: 'POR_FAIXA_PESO_DIA', faixas: [{ pesoMaxKg: 5, quantidadePorDia: 2 }, { pesoMaxKg: 15, quantidadePorDia: 3 }, { pesoMaxKg: 9999, quantidadePorDia: 5 }] },
      observacao: 'Higiene',
    },
    { insumoId: 'seringa-1ml', regra: { tipo: 'POR_COLETA', quantidadePorColeta: 1 }, observacao: 'Coleta de exames' },
    { insumoId: 'agulha-25x7', regra: { tipo: 'POR_COLETA', quantidadePorColeta: 1 }, observacao: 'Coleta de exames' },
    { insumoId: 'tubo-coleta', regra: { tipo: 'POR_COLETA', quantidadePorColeta: 2 }, observacao: 'Coleta de exames' },
  ],
};
