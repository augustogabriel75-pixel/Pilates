# Precificação Inteligente de Internação Veterinária

Motor de cálculo em **TypeScript puro, sem dependências de runtime**, que calcula o custo real de uma internação (medicamentos com tratamento de desperdício, fluidoterapia, insumos, leito, equipamentos e equipe) e sugere o preço de venda já com impostos, taxa do meio de pagamento e margem.

```bash
cd vet-pricing
npm install
npm test          # 74 testes (unitários, cenários, invariantes com 300 entradas aleatórias)
npm run exemplo   # simulação: cão 25 kg e gato 3,5 kg, 3 dias
npm run typecheck
```

---

## 1. Arquitetura

```
src/
├── tipos.ts                 Entidades, entrada e saída (contrato da API)
├── constantes.ts            Frequências, padrões e faixas de referência
├── erros.ts                 ErroCalculo (código estável + campo) e validadores
├── calculadora.ts           calculateHospitalizationCost (orquestração) + paraInternacaoOrcamento
├── util/numeros.ts          Arredondamentos seguros e dinheiro em centavos
└── modulos/
    ├── recipientes.ts       Motor de consumo de ampolas, frascos e bolsas (desperdício)
    ├── medicamentos.ts      Dose → linha do tempo → recipientes → seringas/diluentes/alertas
    ├── fluidoterapia.ts     Manutenção + déficit + perdas → bolsas, equipo, bomba
    ├── insumos.ts           Regras de consumo, manejos, consolidação para estoque
    ├── operacional.ts       Leito (rateio de custos fixos), depreciação, mão de obra
    ├── comercial.ts         Impostos, taxas de cartão, margem → preço final
    └── protocolos.ts        Combinação de protocolos de tratamento
sql/schema.sql               Schema PostgreSQL (validado no PostgreSQL 16)
examples/                    Catálogo e configuração de exemplo + script de simulação
tests/                       node:test
```

`calculateHospitalizationCost(entrada)` é **pura**: recebe catálogo e configuração já carregados, não acessa banco, relógio ou rede, não altera a entrada e é determinística (há teste para isso). Assim, o mesmo código roda na API, num worker ou no frontend para simulação em tempo real.

Pipeline:

1. Validação da entrada → `ErroCalculo`
2. Medicamentos: dose → horários → simulação de recipientes → seringas, diluentes e equipamentos derivados
3. Fluidoterapia: volume hora a hora → bolsas → equipo e bomba
4. Manejos (horários distintos) e insumos por regra
5. Margem de segurança sobre os custos diretos
6. Custos operacionais: leito, equipamentos, mão de obra
7. Impostos, taxa do pagamento e margem → preço final, diária e tabela por forma de pagamento

Cada linha da saída traz `memoriaCalculo` (ex.: `"25 mg/kg × 25 kg = 625 mg ÷ 500 mg/mL = 1,25 mL"`) para auditoria e para mostrar ao tutor.

---

## 2. Modelo de dados

| Entidade (TS) | Tabela (SQL) | Campos principais |
|---|---|---|
| `Medicamento` | `medicamento` | nome, princípio ativo, apresentação (tipo de recipiente, unidade base, conteúdo, resolução de medida), concentração, preço de custo do recipiente, uso único, validade após aberto, política padrão, insumos por recipiente aberto, faixa de dose por espécie |
| `Insumo` | `insumo` | nome, categoria, unidade de consumo, custo unitário, fracionável, capacidade (seringas/bolsas), validade após aberto |
| `Equipamento` | `equipamento` | aquisição, residual, vida útil, manutenção anual, taxa de utilização |
| `Paciente` / `Tutor` | `paciente` / `tutor` | espécie, peso |
| `ProtocoloTratamento` | `protocolo_tratamento` + `protocolo_prescricao` + `protocolo_insumo` | prescrições, fluidoterapia e insumos reutilizáveis |
| `ConfiguracaoClinica` | `clinica`, `custo_fixo_mensal`, `categoria_leito_*`, `profissional` | custos fixos, leitos, ocupação, equipe por categoria |
| `ParametrosComerciais` | `parametro_comercial`, `imposto`, `taxa_credito` | margem, impostos, taxas |
| `InternacaoOrcamento` | `internacao_orcamento` + `orcamento_medicamento` + `orcamento_insumo` | resumo financeiro + **snapshot** completo da entrada e do resultado |

O orçamento guarda o snapshot dos custos usados: se o preço de estoque mudar amanhã, um orçamento já enviado ao tutor não muda. Dinheiro no banco é sempre `NUMERIC`, nunca `FLOAT`.

---

## 3. Algoritmo

### A. Medicações

```
Dose por aplicação (ativo) = peso (kg) × dose (mg/kg)           [ou dose fixa: mg, mL, comprimido]
Volume por aplicação (mL)  = ativo ÷ concentração (mg/mL)
                             → arredondado PARA CIMA à graduação mensurável (0,01 mL; ¼ de comprimido)
Nº de aplicações           = ⌈ duração do tratamento ÷ intervalo ⌉
CRI (por preparo)          = taxa (mg/kg/h, mcg/kg/h, mcg/kg/min, mL/kg/h) × peso × horas do preparo
```

Unidades: mg ↔ mcg são convertidas automaticamente. Combinações sem sentido (UI com concentração em mg, mL/kg num comprimido) geram `UNIDADE_INCOMPATIVEL`.

**Frequências.** O sistema usa a nomenclatura clássica: **SID = 24/24 h, BID = 12/12 h, TID = 8/8 h, QID = 6/6 h**, além de `Q4H`, `Q2H`, `DOSE_UNICA`, `CRI` e intervalo livre `{ intervaloHoras }`. O enunciado original listava "SID/12h, BID/8h, TID/6h, QID/4h". Esse mapeamento está deslocado em uma posição e dobraria as aplicações de um SID, por isso **não** foi seguido. Q4H existe como frequência própria.

#### Desperdício: três políticas

A política é resolvida nesta ordem: prescrição → medicamento → `usoUnico` (ampola inteira) → `validadeAposAbertoHoras` (por estabilidade) → padrão da clínica.

| Política | Quando usar | Cobrança |
|---|---|---|
| `FRACIONADO` | Frasco multidose compartilhado entre pacientes | Só o volume usado × custo/mL |
| `RECIPIENTE_INTEIRO` | Ampola de uso único, fármaco sem conservante | Cada aplicação abre ⌈dose ÷ conteúdo⌉ recipientes e a sobra é descartada |
| `POR_ESTABILIDADE` | Frasco dedicado ao paciente com validade após aberto/reconstituído | A sobra é reaproveitada até vencer. Ao vencer, ou na alta, o saldo é descartado e cobrado |

A política `POR_ESTABILIDADE` é uma **simulação na linha do tempo**. Exemplo real do teste: ceftriaxona 1 g reconstituída em 10 mL (estável por 24 h), 6,25 mL BID:

```
h0   abre F1 (vence h24)          usa 6,25 → saldo 3,75
h12  usa 3,75 de F1 + abre F2 (vence h36) e usa 2,50 → saldo 7,50
h24  usa 6,25 de F2 → saldo 1,25
h36  F2 venceu: descarta 1,25; abre F3 (vence h60) → saldo 3,75
h48  usa 3,75 de F3 + abre F4 (vence h72) e usa 2,50 → saldo 7,50
h60  usa 6,25 de F4 → saldo 1,25 → descartado na alta
= 4 frascos, 37,5 mL usados, 2,5 mL descartados (custo do desperdício separado na linha)
```

Insumos derivados da medicação:
- **Seringa automática**: escolhe a menor seringa do catálogo que comporta a dose, mais a agulha padrão. Vale para IV/IM/SC em mL; dá para desligar por prescrição.
- **`insumosPorAplicacao`**: itens consumidos a cada aplicação ou preparo de CRI (ex.: seringa de 20 mL para a bomba).
- **`insumosPorRecipienteAberto`**: itens por frasco aberto, como o diluente de reconstituição. No modo fracionado, entram proporcionalmente.
- **`equipamentoId`**: ocupa um equipamento durante o tratamento (ex.: bomba de seringa) e entra no custo de depreciação.

#### Fluidoterapia

```
Manutenção (mL/h) = taxa (mL/kg/h) × peso
Déficit (mL)      = % desidratação × peso × 10, reposto linearmente em N horas (padrão 24 h)
Perdas (mL/h)     = perdas contínuas (mL/dia) ÷ 24
```

O volume é simulado hora a hora contra as bolsas com o mesmo motor `POR_ESTABILIDADE`: a bolsa aberta vale 24 h e o saldo vencido é descartado. Equipo: ⌈horas ÷ troca⌉. A bomba de infusão entra como equipamento.

#### Insumos: regras de consumo

| Regra | Quantidade |
|---|---|
| `FIXO` | por internação |
| `POR_DIA` | × dias iniciados (⌈h ÷ 24⌉) |
| `POR_TROCA` | ⌈h ÷ intervalo de troca⌉ × qtd/troca (cateter, extensor, torneirinha, fixação) |
| `POR_MANEJO` | × manejos (luvas) |
| `POR_APLICACAO` | × aplicações de medicamento (swab de álcool) |
| `POR_COLETA` | × coletas de exame previstas |
| `POR_FAIXA_PESO_DIA` | por dia, conforme faixa de peso (tapetes, fraldas) |

Todas aceitam `perdaPrevistaUnidades` (ex.: +1 cateter para obstrução). Itens não fracionáveis são arredondados para cima; fracionáveis (fita em cm, clorexidina em mL) não.

**Manejos** = horários *distintos* em que o paciente é manipulado: aplicações e preparos, trocas de bolsa e a rotina de aferição da categoria (Geral 6/6 h, Semi 4/4 h, UTI 2/2 h). Duas medicações no mesmo horário contam como um manejo, então o mesmo par de luvas atende as duas.

#### Margem de segurança

Percentual configurável por grupo (medicamentos, insumos, fluidoterapia) sobre o custo direto. Cobre imprevistos estatísticos, como cateter obstruído, seringa contaminada ou dose repetida por regurgitação. É complementar à `perdaPrevistaUnidades`, que cobre perdas já esperadas para aquele paciente. Sem margem, o sistema emite o alerta `SEM_MARGEM_SEGURANCA`.

### B. Custos operacionais

```
Leito/h          = Σ custos fixos mensais ÷ (leitos × horas/mês × ocupação média) × fator da categoria
Equipamento/h    = [(aquisição − residual) ÷ vida útil + manutenção anual] ÷ (8.760 h × utilização)
Mão de obra/h    = custo-hora do profissional ÷ pacientes por profissional (por categoria)
```

Dividir pela **ocupação média** faz o paciente internado absorver o custo da ociosidade, já que o custo fixo existe com ou sem paciente. O fator da categoria (Geral 1,0, Semi 1,4, UTI 2,2 no exemplo) representa o maior consumo de área, energia e limpeza. O monitor multiparamétrico entra como equipamento do leito com a `fracaoUso` por leito. `custoHoraProfissional()` ajuda a chegar ao custo-hora a partir de salário, encargos e benefícios.

### C. Preço de venda

Impostos e taxa de cartão incidem sobre o **preço**, não sobre o custo. Por isso o preço sai por divisor (gross-up):

```
SOBRE_CUSTO (padrão, markup):     P = C × (1 + m) ÷ (1 − t − f)     → lucro = C × m
SOBRE_PRECO (margem líquida):     P = C ÷ (1 − t − f − m)           → lucro = P × m
```

`C` é o custo total, `m` a margem, `t` a soma das alíquotas e `f` a taxa da forma de pagamento escolhida. Somar percentuais ao custo (`C × (1 + m + t + f)`) subprecifica, porque o imposto sobre o preço final fica maior do que o reservado. O sistema também gera a **tabela de preços por forma de pagamento** (PIX, débito, crédito 1x–6x), com a 1ª parcela absorvendo os centavos para que a soma das parcelas feche no preço.

**Precisão monetária.** Cada linha é arredondada a centavos e os totais são somas de centavos inteiros. Logo, total = soma das linhas exatamente, e `preço = custo + lucro + impostos + taxa` fecha ao centavo. Esses invariantes são verificados em 300 entradas pseudoaleatórias.

---

## 4. Exceções e alertas

**Erros** (`ErroCalculo`, com `codigo` e `campo`) — use HTTP 422 na API:

| Código | Situação |
|---|---|
| `VALOR_INVALIDO` | peso/duração/dose ≤ 0, percentual negativo, ocupação fora de (0, 1] |
| `REFERENCIA_INEXISTENTE` | medicamento, insumo, equipamento ou profissional fora do catálogo |
| `UNIDADE_INCOMPATIVEL` | unidade da dose incompatível com a concentração ou a apresentação |
| `JANELA_INVALIDA` | prescrição que começa após a alta |
| `CATEGORIA_NAO_CONFIGURADA` | categoria de leito sem configuração |
| `PERCENTUAIS_INVIAVEIS` | impostos + taxa (+ margem) ≥ 100% |
| `PARCELAMENTO_INDISPONIVEL` | sem taxa cadastrada para o número de parcelas |
| `CADASTRO_INCOMPLETO` | bolsa de fluido sem capacidade |
| `FAIXA_PESO_NAO_COBERTA`, `ID_DUPLICADO`, `PROTOCOLO_INCOMPATIVEL`, `FREQUENCIA_INVALIDA` | autoexplicativos |

**Alertas** (não bloqueiam o cálculo):

| Código | Nível | Situação |
|---|---|---|
| `PESO_ATIPICO` | CRÍTICO | peso fora da faixa da espécie (provável g × kg) |
| `DOSE_FORA_DA_FAIXA` | CRÍTICO | dose fora da faixa de referência cadastrada para a espécie |
| `MICRODOSE` | ATENÇÃO | volume < 0,1 mL: sugere diluição ou seringa de insulina |
| `DESPERDICIO_ELEVADO` | ATENÇÃO | ≥ 50% do custo do item é sobra descartada |
| `CONTROLADO` | INFO | medicamento controlado |
| `SEM_MARGEM_SEGURANCA` | INFO | nenhuma margem de segurança aplicada |

---

## 5. Resultados da simulação (`npm run exemplo`)

Preços, salários e doses do catálogo de exemplo são **ilustrativos**. Na clínica, os valores vêm do estoque e do financeiro, e as doses, da prescrição do médico-veterinário.

| | Cão 25 kg — Geral, 72 h | Gato 3,5 kg — Semi-intensiva, 72 h |
|---|---:|---:|
| Medicamentos | R$ 156,88 | R$ 114,56 |
| Fluidoterapia | R$ 47,40 (6 L, 6 bolsas) | R$ 19,60 (679 mL, 4 bolsas de 250 mL) |
| Insumos | R$ 80,83 (4 cateteres, 18 manejos) | R$ 66,76 (27 manejos) |
| Margem de segurança | R$ 17,34 | R$ 13,00 |
| **Custo direto** | **R$ 302,45** | **R$ 213,92** |
| Leito + equipamentos + equipe | R$ 900,24 | R$ 1.438,30 |
| **Custo total** | **R$ 1.202,69** | **R$ 1.652,22** |
| **Preço final (crédito 3x)** | **R$ 1.914,43** | **R$ 2.629,99** |
| Diária sugerida | R$ 638,14 | R$ 876,66 |
| Preço no PIX | R$ 1.800,03 | R$ 2.472,83 |

No gato, a metadona (0,2 mg/kg = **0,07 mL** de uma ampola de 1 mL, QID) descarta 93% de cada ampola: R$ 72,54 de R$ 78,00. Cobrar somente a fração usada reduziria os medicamentos de R$ 114,56 para R$ 29,92 e o preço final em R$ 141,46. O sistema mostra esse número e emite os alertas `MICRODOSE` e `DESPERDICIO_ELEVADO`.

---

## 6. Integração

```ts
// app/api/internacao/orcamento/route.ts (Next.js) — mesmo padrão serve para Express/Fastify.
// Consuma o pacote como dependência local: "vet-pricing": "file:./vet-pricing" no package.json.
import { calculateHospitalizationCost, paraInternacaoOrcamento, ErroCalculo } from 'vet-pricing';

export async function POST(req: Request) {
  const { pacienteId, internacao, prescricoes, fluidoterapia, insumos } = await req.json();
  // carregar do banco: paciente, catálogo, configuração da clínica e parâmetros comerciais
  const entrada = { paciente, internacao, prescricoes, fluidoterapia, insumos, catalogo, clinica, comercial, margemSeguranca };
  try {
    const resultado = calculateHospitalizationCost(entrada);
    const orcamento = paraInternacaoOrcamento(crypto.randomUUID(), entrada, resultado, { criadoEm: new Date().toISOString() });
    // persistir orcamento (entrada + snapshot) em internacao_orcamento
    return Response.json(orcamento, { status: 201 });
  } catch (e) {
    if (e instanceof ErroCalculo) return Response.json({ codigo: e.codigo, campo: e.campo, mensagem: e.message }, { status: 422 });
    throw e;
  }
}
```

No frontend, a mesma função pode recalcular a cada mudança na prescrição, porque não faz I/O e roda em milissegundos. Antes de persistir, valide o corpo da requisição com o schema da sua API (ex.: zod).

## 7. Limitações e próximos passos

- Alíquota de impostos única sobre o total. Se a clínica tributa medicamentos (revenda) e serviços de forma diferente, o próximo passo é separar a base de cálculo por natureza.
- A mão de obra é rateada por proporção de pacientes por profissional. Procedimentos com tempo dedicado (ex.: sondagem, curativos complexos) podem ser cobrados como itens à parte.
- As faixas de dose de referência servem só para alerta e devem ser cadastradas e revisadas pela equipe clínica.
