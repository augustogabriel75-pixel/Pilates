-- ════════════════════════════════════════════════════════════════════════════
-- Precificação de internação veterinária — schema PostgreSQL 14+
--
-- Princípios:
--   • Multi-clínica (clinica_id em todos os cadastros).
--   • Dinheiro: NUMERIC(14,2) para totais e NUMERIC(14,6) para custos unitários
--     (ex.: R$ 0,012/cm de fita). Nunca FLOAT.
--   • Orçamentos guardam SNAPSHOT dos custos usados: mudar o preço do estoque amanhã
--     não altera um orçamento já enviado ao tutor.
--   • Regras de consumo e doses em JSONB tipado pelo TypeScript (src/tipos.ts),
--     com colunas físicas para o que é filtrado/indexado.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TYPE especie            AS ENUM ('CAO', 'GATO', 'EQUINO', 'BOVINO', 'EXOTICO');
CREATE TYPE categoria_leito    AS ENUM ('GERAL', 'SEMI_INTENSIVA', 'UTI', 'ISOLAMENTO');
CREATE TYPE unidade_base       AS ENUM ('mL', 'comprimido');
CREATE TYPE unidade_ativo      AS ENUM ('mg', 'mcg', 'UI');
CREATE TYPE tipo_recipiente    AS ENUM ('AMPOLA', 'FRASCO_AMPOLA', 'FRASCO', 'BOLSA', 'BLISTER', 'SERINGA_PREENCHIDA');
CREATE TYPE politica_desperdicio AS ENUM ('FRACIONADO', 'RECIPIENTE_INTEIRO', 'POR_ESTABILIDADE');
CREATE TYPE categoria_insumo   AS ENUM ('CATETER', 'EQUIPO', 'EXTENSOR', 'TORNEIRA', 'FIXACAO', 'ANTISSEPSIA', 'SERINGA',
                                        'AGULHA', 'HIGIENE', 'LUVA', 'CONFORTO', 'FLUIDO', 'DILUENTE', 'COLETA', 'OUTROS');
CREATE TYPE status_orcamento   AS ENUM ('RASCUNHO', 'ENVIADO', 'APROVADO', 'RECUSADO', 'CONVERTIDO');

CREATE TABLE clinica (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                    TEXT NOT NULL,
  horas_operacionais_mes  NUMERIC(6,2)  NOT NULL DEFAULT 720 CHECK (horas_operacionais_mes > 0),
  total_leitos            INTEGER       NOT NULL CHECK (total_leitos > 0),
  taxa_ocupacao_media     NUMERIC(5,4)  NOT NULL CHECK (taxa_ocupacao_media > 0 AND taxa_ocupacao_media <= 1),
  politica_desperdicio_padrao politica_desperdicio NOT NULL DEFAULT 'FRACIONADO',
  limite_microdose_ml     NUMERIC(8,4)  NOT NULL DEFAULT 0.1,
  agulha_padrao_insumo_id UUID,         -- FK adicionada após a criação de insumo
  criado_em               TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE custo_fixo_mensal (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id  UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
  descricao   TEXT NOT NULL,
  valor       NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  vigente_de  DATE NOT NULL DEFAULT CURRENT_DATE,
  vigente_ate DATE
);
CREATE INDEX ix_custo_fixo_clinica ON custo_fixo_mensal (clinica_id, vigente_de);

-- ─── Pacientes ──────────────────────────────────────────────────────────────

CREATE TABLE tutor (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES clinica(id),
  nome       TEXT NOT NULL,
  documento  TEXT,
  telefone   TEXT
);

CREATE TABLE paciente (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES clinica(id),
  tutor_id   UUID NOT NULL REFERENCES tutor(id),
  nome       TEXT NOT NULL,
  especie    especie NOT NULL,
  raca       TEXT,
  peso_kg    NUMERIC(8,3) NOT NULL CHECK (peso_kg > 0),
  peso_aferido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_paciente_tutor ON paciente (tutor_id);

-- ─── Estoque ────────────────────────────────────────────────────────────────

CREATE TABLE medicamento (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id                 UUID NOT NULL REFERENCES clinica(id),
  nome                       TEXT NOT NULL,
  principio_ativo            TEXT NOT NULL,
  tipo_recipiente            tipo_recipiente NOT NULL,
  unidade_base               unidade_base NOT NULL,
  quantidade_por_recipiente  NUMERIC(12,4) NOT NULL CHECK (quantidade_por_recipiente > 0),
  resolucao_medida           NUMERIC(8,4) CHECK (resolucao_medida > 0),
  concentracao_valor         NUMERIC(14,6) NOT NULL CHECK (concentracao_valor > 0),
  concentracao_unidade       unidade_ativo NOT NULL,
  preco_custo_recipiente     NUMERIC(14,6) NOT NULL CHECK (preco_custo_recipiente >= 0),
  uso_unico                  BOOLEAN NOT NULL DEFAULT FALSE,
  validade_apos_aberto_horas NUMERIC(8,2) CHECK (validade_apos_aberto_horas > 0),
  politica_desperdicio_padrao politica_desperdicio,
  controlado                 BOOLEAN NOT NULL DEFAULT FALSE,
  -- [{ "insumoId": "...", "quantidade": 1 }]
  insumos_por_recipiente_aberto JSONB NOT NULL DEFAULT '[]',
  -- { "CAO": { "min": 10, "max": 25, "unidade": "mg/kg" } }
  faixa_dose_referencia      JSONB NOT NULL DEFAULT '{}',
  ativo                      BOOLEAN NOT NULL DEFAULT TRUE,
  atualizado_em              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_medicamento_busca ON medicamento (clinica_id, principio_ativo) WHERE ativo;

CREATE TABLE insumo (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id                 UUID NOT NULL REFERENCES clinica(id),
  nome                       TEXT NOT NULL,
  categoria                  categoria_insumo NOT NULL,
  unidade                    TEXT NOT NULL,           -- un, par, cm, mL, bolsa
  custo_unitario             NUMERIC(14,6) NOT NULL CHECK (custo_unitario >= 0),
  fracionavel                BOOLEAN NOT NULL DEFAULT FALSE,
  capacidade_ml              NUMERIC(10,2) CHECK (capacidade_ml > 0),
  validade_apos_aberto_horas NUMERIC(8,2) CHECK (validade_apos_aberto_horas > 0),
  em_catalogo_seringas       BOOLEAN NOT NULL DEFAULT FALSE,
  ativo                      BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT ck_seringa_capacidade CHECK (NOT em_catalogo_seringas OR capacidade_ml IS NOT NULL),
  CONSTRAINT ck_fluido_capacidade  CHECK (categoria <> 'FLUIDO' OR capacidade_ml IS NOT NULL)
);
CREATE INDEX ix_insumo_categoria ON insumo (clinica_id, categoria) WHERE ativo;

ALTER TABLE clinica ADD CONSTRAINT fk_clinica_agulha FOREIGN KEY (agulha_padrao_insumo_id) REFERENCES insumo(id);

CREATE TABLE equipamento (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id       UUID NOT NULL REFERENCES clinica(id),
  nome             TEXT NOT NULL,
  valor_aquisicao  NUMERIC(14,2) NOT NULL CHECK (valor_aquisicao >= 0),
  valor_residual   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_residual >= 0),
  vida_util_anos   NUMERIC(5,2)  NOT NULL CHECK (vida_util_anos > 0),
  manutencao_anual NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (manutencao_anual >= 0),
  taxa_utilizacao  NUMERIC(5,4)  NOT NULL CHECK (taxa_utilizacao > 0 AND taxa_utilizacao <= 1),
  CHECK (valor_residual <= valor_aquisicao)
);

-- ─── Leitos e equipe ────────────────────────────────────────────────────────

CREATE TABLE profissional (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES clinica(id),
  funcao     TEXT NOT NULL,
  custo_hora NUMERIC(14,4) NOT NULL CHECK (custo_hora >= 0)
);

CREATE TABLE categoria_leito_config (
  clinica_id                    UUID NOT NULL REFERENCES clinica(id),
  categoria                     categoria_leito NOT NULL,
  fator_ponderacao_estrutura    NUMERIC(6,3) NOT NULL CHECK (fator_ponderacao_estrutura > 0),
  intervalo_manejo_rotina_horas NUMERIC(5,2) NOT NULL CHECK (intervalo_manejo_rotina_horas > 0),
  PRIMARY KEY (clinica_id, categoria)
);

CREATE TABLE categoria_leito_equipamento (
  clinica_id     UUID NOT NULL,
  categoria      categoria_leito NOT NULL,
  equipamento_id UUID NOT NULL REFERENCES equipamento(id),
  fracao_uso     NUMERIC(5,4) NOT NULL CHECK (fracao_uso > 0 AND fracao_uso <= 1),
  PRIMARY KEY (clinica_id, categoria, equipamento_id),
  FOREIGN KEY (clinica_id, categoria) REFERENCES categoria_leito_config (clinica_id, categoria) ON DELETE CASCADE
);

CREATE TABLE categoria_leito_equipe (
  clinica_id                 UUID NOT NULL,
  categoria                  categoria_leito NOT NULL,
  profissional_id            UUID NOT NULL REFERENCES profissional(id),
  pacientes_por_profissional NUMERIC(6,2) NOT NULL CHECK (pacientes_por_profissional > 0),
  PRIMARY KEY (clinica_id, categoria, profissional_id),
  FOREIGN KEY (clinica_id, categoria) REFERENCES categoria_leito_config (clinica_id, categoria) ON DELETE CASCADE
);

-- ─── Comercial ──────────────────────────────────────────────────────────────

CREATE TABLE parametro_comercial (
  clinica_id         UUID PRIMARY KEY REFERENCES clinica(id),
  margem_lucro_pct   NUMERIC(6,2) NOT NULL CHECK (margem_lucro_pct >= 0),
  modo_margem        TEXT NOT NULL DEFAULT 'SOBRE_CUSTO' CHECK (modo_margem IN ('SOBRE_CUSTO', 'SOBRE_PRECO')),
  margem_seg_medicamentos_pct NUMERIC(5,2) NOT NULL DEFAULT 5,
  margem_seg_insumos_pct      NUMERIC(5,2) NOT NULL DEFAULT 10,
  margem_seg_fluido_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
  pix_pct            NUMERIC(5,2) NOT NULL DEFAULT 0,
  debito_pct         NUMERIC(5,2) NOT NULL DEFAULT 0
);

CREATE TABLE imposto (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id  UUID NOT NULL REFERENCES clinica(id),
  nome        TEXT NOT NULL,
  aliquota_pct NUMERIC(6,3) NOT NULL CHECK (aliquota_pct >= 0)
);

CREATE TABLE taxa_credito (
  clinica_id UUID NOT NULL REFERENCES clinica(id),
  parcelas   SMALLINT NOT NULL CHECK (parcelas BETWEEN 1 AND 24),
  taxa_pct   NUMERIC(5,2) NOT NULL CHECK (taxa_pct >= 0),
  PRIMARY KEY (clinica_id, parcelas)
);

-- ─── Protocolos ─────────────────────────────────────────────────────────────

CREATE TABLE protocolo_tratamento (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id               UUID NOT NULL REFERENCES clinica(id),
  nome                     TEXT NOT NULL,
  indicacao                TEXT NOT NULL,
  especies                 especie[],                       -- NULL = todas
  categoria_leito_sugerida categoria_leito,
  fluidoterapia            JSONB                             -- PrescricaoFluidoterapia
);

CREATE TABLE protocolo_prescricao (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id   UUID NOT NULL REFERENCES protocolo_tratamento(id) ON DELETE CASCADE,
  medicamento_id UUID NOT NULL REFERENCES medicamento(id),
  ordem          SMALLINT NOT NULL DEFAULT 0,
  -- Prescricao sem medicamentoId: { via, frequencia, dose | taxa, politicaDesperdicio, ... }
  definicao      JSONB NOT NULL
);

CREATE TABLE protocolo_insumo (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id UUID NOT NULL REFERENCES protocolo_tratamento(id) ON DELETE CASCADE,
  insumo_id    UUID NOT NULL REFERENCES insumo(id),
  regra        JSONB NOT NULL,                                -- RegraConsumo
  perda_prevista_unidades NUMERIC(10,3) NOT NULL DEFAULT 0,
  observacao   TEXT
);

-- ─── Orçamentos (snapshot imutável) ─────────────────────────────────────────

CREATE TABLE internacao_orcamento (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id               UUID NOT NULL REFERENCES clinica(id),
  paciente_id              UUID NOT NULL REFERENCES paciente(id),
  peso_kg_no_calculo       NUMERIC(8,3) NOT NULL,
  duracao_horas            NUMERIC(8,2) NOT NULL CHECK (duracao_horas > 0),
  categoria_leito          categoria_leito NOT NULL,
  custo_medicamentos       NUMERIC(14,2) NOT NULL,
  custo_fluidoterapia      NUMERIC(14,2) NOT NULL,
  custo_insumos            NUMERIC(14,2) NOT NULL,
  margem_seguranca         NUMERIC(14,2) NOT NULL,
  custo_direto             NUMERIC(14,2) NOT NULL,
  custos_fixos_calculados  NUMERIC(14,2) NOT NULL,           -- leito + equipamentos + mão de obra
  custo_total              NUMERIC(14,2) NOT NULL,
  margem_lucro_pct         NUMERIC(6,2)  NOT NULL,
  impostos_pct             NUMERIC(6,3)  NOT NULL,
  taxa_pagamento_pct       NUMERIC(5,2)  NOT NULL,
  preco_sugerido_total     NUMERIC(14,2) NOT NULL,
  preco_sugerido_diaria    NUMERIC(14,2) NOT NULL,
  preco_aprovado           NUMERIC(14,2),                   -- valor final negociado, se diferente
  status                   status_orcamento NOT NULL DEFAULT 'RASCUNHO',
  versao_algoritmo         TEXT NOT NULL,
  entrada                  JSONB NOT NULL,                  -- EntradaCalculo (reprodutibilidade)
  snapshot                 JSONB NOT NULL,                  -- ResultadoCalculo completo
  criado_por               UUID,
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (custo_total = custo_direto + custos_fixos_calculados)
);
CREATE INDEX ix_orcamento_paciente ON internacao_orcamento (paciente_id, criado_em DESC);
CREATE INDEX ix_orcamento_status   ON internacao_orcamento (clinica_id, status);

-- Linhas desnormalizadas para relatórios (consumo por medicamento, desperdício por item).
CREATE TABLE orcamento_medicamento (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id            UUID NOT NULL REFERENCES internacao_orcamento(id) ON DELETE CASCADE,
  medicamento_id          UUID NOT NULL REFERENCES medicamento(id),
  politica_desperdicio    politica_desperdicio NOT NULL,
  quantidade_por_aplicacao NUMERIC(12,4) NOT NULL,
  numero_aplicacoes       INTEGER NOT NULL,
  recipientes_abertos     INTEGER NOT NULL,
  quantidade_utilizada    NUMERIC(12,4) NOT NULL,
  quantidade_desperdicada NUMERIC(12,4) NOT NULL,
  preco_custo_recipiente  NUMERIC(14,6) NOT NULL,           -- snapshot
  custo_utilizado         NUMERIC(14,2) NOT NULL,
  custo_desperdicio       NUMERIC(14,2) NOT NULL,
  custo_total             NUMERIC(14,2) NOT NULL
);
CREATE INDEX ix_orc_med ON orcamento_medicamento (medicamento_id);

CREATE TABLE orcamento_insumo (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id   UUID NOT NULL REFERENCES internacao_orcamento(id) ON DELETE CASCADE,
  insumo_id      UUID NOT NULL REFERENCES insumo(id),
  origem         TEXT NOT NULL,
  quantidade     NUMERIC(12,4) NOT NULL,
  custo_unitario NUMERIC(14,6) NOT NULL,                    -- snapshot
  custo_total    NUMERIC(14,2) NOT NULL
);
CREATE INDEX ix_orc_insumo ON orcamento_insumo (insumo_id);

-- Relatório: desperdício de medicamentos por mês (base para renegociar apresentações).
CREATE VIEW vw_desperdicio_mensal AS
SELECT o.clinica_id,
       date_trunc('month', o.criado_em) AS mes,
       m.id   AS medicamento_id,
       m.nome AS medicamento,
       SUM(om.quantidade_desperdicada) AS quantidade_desperdicada,
       SUM(om.custo_desperdicio)       AS custo_desperdicio,
       SUM(om.custo_total)             AS custo_total
FROM orcamento_medicamento om
JOIN internacao_orcamento o ON o.id = om.orcamento_id AND o.status IN ('APROVADO', 'CONVERTIDO')
JOIN medicamento m ON m.id = om.medicamento_id
GROUP BY 1, 2, 3, 4;
