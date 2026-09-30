# Espaço Cativar Pilates

Aplicação web full-stack para o estúdio de **Fisioterapia e Pilates Espaço Cativar**: agenda com turmas recorrentes, controle de presença, prontuário eletrônico, prescrição de exercícios por aparelho, gestão de mensalidades e portal do paciente.

- **Frontend:** Next.js 15 (App Router, React 19) + Tailwind CSS: mobile-first, modo claro/escuro
- **Backend:** rotas de API do Next.js (Node) + middleware de autorização (Edge)
- **Banco:** Prisma ORM + SQLite (troca simples para PostgreSQL), com migração e seed
- **Segurança:** JWT (HS256) em cookie HTTP-only, RBAC, bcrypt, zod, proteção CSRF, headers de segurança, rate-limit no login

---

## Como rodar

Requisito: Node.js 20 ou superior.

```bash
npm install
cp .env.example .env
# gere um segredo forte para o JWT e cole em JWT_SECRET no .env:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

npm run setup      # aplica as migrações e roda o seed
npm run dev        # http://localhost:3000
```

Produção: `npm run build && npm start`. Os cookies são `Secure` em produção, então use HTTPS. Para testar `npm start` em `http://localhost`, defina `COOKIE_SECURE="false"`.

### Credenciais iniciais (seed)

| Perfil | Usuário / e-mail | Senha |
|---|---|---|
| **ADMIN** (fisioterapeuta) | `adm` ou `adm@espacocativar.com.br` | `pilates2026` |
| PATIENT (demo, só com `SEED_DEMO="true"`) | `maria@exemplo.com` | `paciente123` |

> ⚠️ **Troque a senha do administrador no primeiro acesso** (menu *Minha conta*). O seed pode rodar várias vezes: ele não sobrescreve a senha do admin nem duplica dados. Com `SEED_DEMO="false"`, só o administrador e a biblioteca de exercícios são criados.

---

## Funcionalidades

### Painel do administrador (`/admin`)
| Tela | O que faz |
|---|---|
| **Início** | Aulas do dia, ocupação, check-ins, recebido no mês e mensalidades atrasadas |
| **Agenda** | Visões por **dia, semana e mês**, criação de aula avulsa, detalhe da aula (adicionar paciente, alterar limite de vagas, cancelar ou reativar) |
| **Turmas** | Turmas **recorrentes** (ex.: Pilates 2x/semana, seg/qua 08:00) com **limite ajustável de alunos**, matrícula fixa, geração de mais semanas e encerramento |
| **Presença** | Lista diária para validação rápida (Presente, Falta, "Todos presentes"), mostrando o check-in feito pelo aluno |
| **Pacientes** | Cadastro completo com anamnese e acesso ao portal. Ficha com abas: **Prontuário** (evolução diária, escala de dor EVA, avaliação postural, observações e orientação ao paciente), **Exercícios** (prescrição por aparelho: Reformer, Cadillac, Chair, Barrel, Solo, Bola…), **Aulas**, **Financeiro** e **Cadastro** |
| **Financeiro** | Mensalidades por mês/ano, busca por nome, filtro por status, totais e botão para alternar **Pago / Pendente / Atrasado**. Uma mensalidade pendente vira *Atrasado* sozinha quando o vencimento passa |

### Portal do paciente (`/paciente`)
- **Ponto do aluno:** check-in no dia da aula (liberado 2h antes do início) e confirmação de aulas futuras.
- **Reagendamento e reposição:** com pelo menos 12h de antecedência, o paciente reagenda direto para um horário com vaga da mesma modalidade. Um cancelamento com antecedência, ou feito pelo estúdio, gera um **crédito de reposição** válido por 30 dias.
- **Minha agenda:** próximas aulas, créditos e histórico com presenças e faltas.
- **Meus exercícios:** rotinas prescritas, agrupadas por aparelho, com orientações para casa.
- **Minha evolução:** frequência, gráfico da escala de dor e orientações da fisioterapeuta. As anotações clínicas internas **não** aparecem para o paciente.

As regras de negócio (antecedência, validade da reposição, janela de check-in) ficam em `src/lib/constants.ts`.

---

## Estrutura do projeto

```
├── prisma/
│   ├── schema.prisma            # esquema do banco
│   ├── migrations/              # migrações versionadas
│   └── seed.ts                  # admin padrão + biblioteca de exercícios + dados demo
├── public/logo.svg              # logo (substitua pela logo oficial)
├── next.config.mjs              # headers de segurança (CSP, X-Frame-Options, HSTS…)
├── tailwind.config.ts           # paleta: copper (cobre), sand (bege/dourado), mist (cinza)
└── src/
    ├── middleware.ts            # RBAC + CSRF + cookie CSRF (Edge)
    ├── lib/
    │   ├── auth.ts              # assinatura/verificação do JWT (jose)
    │   ├── session.ts           # usuário atual, requirePageRole / requireApiRole
    │   ├── password.ts          # bcrypt (12 rounds, salt por senha)
    │   ├── validation.ts        # esquemas zod de todas as entradas
    │   ├── sanitize.ts          # remoção de HTML/controle em textos livres
    │   ├── rate-limit.ts        # limite de tentativas de login
    │   ├── api.ts               # wrapper de rotas (erros padronizados)
    │   ├── client-api.ts        # fetch do frontend com header CSRF
    │   ├── scheduling.ts        # geração de aulas, matrículas, vagas
    │   ├── reschedule.ts        # regras de reagendamento/reposição
    │   ├── payments.ts          # vencimento e status efetivo
    │   ├── dates.ts             # datas no fuso America/Sao_Paulo
    │   └── constants.ts         # rótulos, aparelhos, modalidades, regras
    ├── components/              # AppShell, ThemeToggle, UI, ActionButton…
    └── app/
        ├── page.tsx             # página inicial
        ├── login/               # login
        ├── admin/               # painel do administrador
        ├── paciente/            # portal do paciente
        └── api/
            ├── auth/            # login, logout, me, change-password
            ├── admin/           # patients, evolutions, prescriptions, classes, sessions, bookings, payments
            └── patient/         # bookings/[id] (checkin/confirm/cancel), reschedule
```

## Esquema do banco (resumo)

| Modelo | Descrição |
|---|---|
| `User` | Login (e-mail/usuário, hash bcrypt, `role` ADMIN/PATIENT, ativo) |
| `Patient` | Cadastro, anamnese, plano, mensalidade e dia de vencimento. Pode ter um `User` associado |
| `ClassGroup` | Turma recorrente (dias da semana, horário, duração, **capacidade**) |
| `Enrollment` | Matrícula fixa do paciente na turma |
| `Session` | Aula concreta na agenda (gerada da turma ou avulsa), com capacidade própria |
| `Booking` | Agendamento: `SCHEDULED`, `CONFIRMED`, `CHECKED_IN`, `ATTENDED`, `ABSENT`, `CANCELLED`, `RESCHEDULED`, mais os campos de reposição |
| `Payment` | Mensalidade por paciente/mês (`PAID`, `PENDING`, `LATE`) |
| `EvolutionRecord` | Prontuário: notas, dor (0–10), avaliação postural, observações, orientação ao paciente |
| `Prescription` / `PrescriptionItem` | Rotina de exercícios, com itens por aparelho (séries, repetições, molas/carga) |
| `Exercise` | Biblioteca de exercícios (sugestões ao prescrever) |

**PostgreSQL:** troque `provider = "sqlite"` por `"postgresql"` em `prisma/schema.prisma`, ajuste `DATABASE_URL`, apague `prisma/migrations` e rode `npx prisma migrate dev --name init`.

---

## Segurança

| Requisito | Implementação |
|---|---|
| Autenticação | JWT HS256 assinado com `JWT_SECRET` (mín. 32 caracteres), com emissor, audiência e expiração de 8h, guardado em cookie **HttpOnly**, `SameSite=Lax` e `Secure` em produção |
| RBAC | `src/middleware.ts` bloqueia `/admin` e `/api/admin/*` para quem não é ADMIN, e `/paciente` e `/api/patient/*` para quem não é PATIENT. Cada página e rota **verifica de novo** no servidor (`requirePageRole`/`requireApiRole`) e consulta o banco, então desativar um usuário corta o acesso na hora |
| Isolamento de dados | Rotas do paciente só acessam registros do próprio `patientId`. Registro de outro paciente responde 404, sem revelar que existe |
| Senhas | bcrypt com 12 rounds e salt automático. Política de no mínimo 8 caracteres, com letras e números |
| Força bruta | 5 tentativas por IP e usuário a cada 15 min (HTTP 429). O bcrypt roda mesmo quando o usuário não existe, para evitar enumeração de contas |
| SQL Injection | Todo acesso ao banco passa pelo Prisma (consultas parametrizadas), sem SQL bruto |
| XSS | O React escapa toda a saída e dados de usuário nunca passam por `dangerouslySetInnerHTML`. Textos livres são sanitizados no servidor (`sanitize.ts`). CSP restritiva e `X-Content-Type-Options` |
| CSRF | Toda requisição `POST/PUT/PATCH/DELETE` na API exige **Origin igual ao host** e **double-submit token** (cookie `cativar_csrf` igual ao header `x-csrf-token`). O cookie de sessão também é SameSite |
| Validação | Esquemas zod em todas as entradas (tipos, tamanhos, formatos, enums), `Content-Type` JSON obrigatório e erros sem detalhes internos |
| Headers | CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` e HSTS em produção. `X-Powered-By` desativado |
| Open redirect | O parâmetro `next` do login aceita só caminhos internos compatíveis com o perfil |

> O rate-limit fica em memória, por instância. Com várias instâncias, use Redis ou similar.

---

## Scripts

| Comando | Ação |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run setup` | `migrate deploy` + seed |
| `npm run db:migrate` | Cria/aplica migrações (desenvolvimento) |
| `npm run db:seed` | Executa o seed |
| `npm run db:reset` | Recria o banco do zero (apaga os dados) |
| `npm run typecheck` | Verificação de tipos TypeScript |

## Identidade visual

A paleta vem da logo: **cobre** (`copper-500 #A86B45`), **bege/dourado** (`sand-400 #C9A97A`) e **cinza suave** (`mist-500 #8A847E`). A tipografia usa Cormorant Garamond nos títulos e Nunito Sans no texto. Para usar a logo oficial, substitua `public/logo.svg` e `src/app/icon.svg`.
