# Painel Master DesenvolvaIN
## Do protótipo aprovado ao sistema real — status e plano

---

## 1. Contexto

O protótipo visual (`apps/admin-desenvolvain`, 11 telas, inicialmente 100% mock) foi aprovado e
conectado ao backend real do Barberaria (`apps/api`) de forma incremental, sprint a sprint. Este
documento começou como plano e agora também registra o que já foi de fato construído — seção 6 marca
cada sprint como concluído ou pendente.

Backend usado: `/v1/admin/*`, sempre atrás de `@Roles('super_admin')`, sem `TenantContextInterceptor`
(seção 6.4 do `CLAUDE.md`).

## 2. Status atual (resumo)

**Concluído e em produção local** (Sprints 1–6 + uma feature extra fora da sequência original):
login de super_admin, CRUD de Barbearias, Onboarding completo (cria tenant + admin + assinatura numa
transação), Dashboard com métricas reais (tenants, barbeiros, agendamentos, MRR, trials), Usuários
cross-tenant, catálogo de Planos (trial/pro/enterprise), Assinaturas, Financeiro (MRR/ARR real +
registro manual de pagamentos) e Repasses (registro manual com cálculo de líquido). Configurações da
Plataforma também foi conectada (fora da sequência original de sprints, puxada pra frente porque a
tela já estava com bug visível) — domínio/e-mail/webhook/trial editáveis, e as cores de
fundo/acento re-temeiam o painel inteiro ao vivo.

**Ainda mock/não construído:** Suporte, Releases, impersonação ("Acessar como admin"), deploy em
produção.

## 3. Arquitetura

`apps/admin-desenvolvain` é um app dentro do monorepo (não é mais repositório separado — movido
depois do Sprint 1). Mesma stack dos outros frontends (React+Vite), mesmo padrão de auth (JWT em
memória + refresh via cookie httpOnly, `apiFetch` idêntico ao de `painel-barbearia`). Todo endpoint
novo segue o padrão de `AdminTenantsController`: módulo NestJS próprio, `JwtAuthGuard`+`RolesGuard`,
`@Roles('super_admin')`.

**Tema do painel:** os tokens de cor (`T` em `App.jsx`) são mutados em runtime por `applyTheme()`
quando as Configurações da Plataforma são carregadas/salvas — `T.bg`/`T.lime` vêm direto do banco,
e `T.surface`/`card`/`border`/`borderHi` são **derivados** do `bg` (função `lighten()`, mistura com
branco) pra manter a hierarquia visual em vez de travar tudo na mesma cor. Isso é mutação de objeto
compartilhado, não Context — funciona porque todo componente do arquivo lê `T.xxx` direto no render.

## 4. Modelo de dados (o que existe hoje)

| Modelo | tenant_id? | RLS | Status |
|---|---|---|---|
| `Plan` | Não | Isenta (catálogo global) | ✅ Sprint 4 |
| `Subscription` | Sim | **Normal** | ✅ Sprint 5 |
| `Payment` | Sim | **Normal** | ✅ Sprint 6 |
| `Payout` (Repasse) | Sim | **Normal** | ✅ Sprint 6 |
| `PlatformSettings` | Não | Isenta (singleton global) | ✅ feature extra |
| `SupportTicket` | Sim | Normal (planejado) | ⏳ Sprint 8 |
| `Release` | Não | Isenta (planejado) | ⏳ Sprint 9 (parcial) |

### Mudança de decisão registrada durante a execução (Sprint 5)

O plano original prescrevia `Subscription`/`Payment`/`Payout` **isentas** de RLS (mesma exceção de
`tenants`/`plans`). Isso foi revisto e invertido durante a implementação: são dado **do tenant**, não
da plataforma — mesma categoria de `services`/`appointments`. Ficaram com RLS normal, e a leitura
cross-tenant do Super Admin soma por tenant via `TenantContextService` (mesmo mecanismo usado desde o
Sprint 2 pra `users`/`appointments`, que também têm RLS forçado). Nenhum bypass de RLS novo foi
criado em nenhum momento do projeto.

**Achado técnico relevante** (Sprint 2): a role de runtime (`barberaria_app`) é `NOBYPASSRLS` de
propósito (`scripts/setup-app-role.ts`) — leitura cross-tenant direta em tabela com RLS forçado
falha com erro (`appointments`, sem `missing_ok` na policy) ou retorna vazio silenciosamente
(`users`, que tem `missing_ok` por causa do carve-out do super_admin, migration `0002`). Toda leitura
cross-tenant no painel master soma por tenant, nunca lê direto.

## 5. Endpoints existentes

```
GET   /v1/admin/dashboard/overview          — tenants, barbeiros, agendamentos, MRR, trials, pagamentos pendentes
GET   /v1/admin/tenants                     GET/:id   POST   PATCH /:id
GET   /v1/admin/users                       — cross-tenant, filtro role/tenantId
GET   /v1/admin/plans                       POST      PATCH /:id
GET   /v1/admin/subscriptions               GET/PATCH /v1/admin/tenants/:tenantId/subscription (upsert)
GET   /v1/admin/payments                    POST/PATCH /v1/admin/tenants/:tenantId/payments[/:id]
GET   /v1/admin/payouts                     POST/PATCH /v1/admin/tenants/:tenantId/payouts[/:id]
GET   /v1/admin/settings                    PATCH /v1/admin/settings
```

## 6. Sprints

### ✅ Sprint 1 — Onboarding real + acerto de contrato
Login funcional, Onboarding conectado (`createTenant()` real), Barbearias (lista+detalhe+suspender)
conectada. `CreateTenantDto.admin` ganhou os campos que faltavam no protótipo.

### ✅ Sprint 2 — Dashboard real (parcial)
`GET /v1/admin/dashboard/overview` — tenants por status, barbeiros ativos, agendamentos do mês, tudo
cross-tenant somando por tenant (achado do `NOBYPASSRLS` documentado na seção 4).

### ✅ Sprint 3 — Usuários cross-tenant
`GET /v1/admin/users`, filtro por role/tenant. Super_admin sai direto (carve-out da migration 0002);
demais papéis somam por tenant.

### ✅ Sprint 4 — Catálogo de Planos
**Decisão confirmada:** 3 planos — `trial`, `pro`, `enterprise` (sem "Starter", diferente do
protótipo original). `code` travado nesses 3 valores, resto editável pela tela.

### ✅ Sprint 5 — Assinaturas + Onboarding completo
`Subscription` (RLS normal, ver seção 4). Onboarding completo: passo 1 usa planos reais, passo 3
mostra módulos do plano escolhido (só leitura), passo 4 persiste tenant+admin+assinatura numa
transação. Bug real corrigido em teste: `upsert` do Prisma quebrava com campo `undefined` no
`update` — trocado por create/update explícito.

### ✅ Sprint 6 — Financeiro & Repasses
MRR real (soma de `plan.priceCents` das assinaturas ativas). `Payment`/`Payout` com registro manual,
sem motor de cálculo automático — Repasse só faz a aritmética (líquido = bruto − taxa%) sobre valores
digitados pelo Super Admin. **Sem detecção automática de inadimplência** — "pagamentos pendentes" é
só contagem do status marcado manualmente, nenhuma regra de prazo/carência inventada.

### ✅ Feature extra (fora da sequência) — Configurações da Plataforma
`PlatformSettings` singleton (migration já insere a linha inicial, `GET` nunca dá 404). Domínio,
e-mail de suporte, webhook, trial padrão editáveis; cores de fundo/acento com `<input type="color">`
nativo + preview ao vivo, aplicando no painel inteiro ao salvar (ver mecanismo na seção 3). Puxada
pra frente do Sprint 9 original porque a tela já estava visível e com bug (cliques não faziam nada).

**Bugs corrigidos depois de reportados:**
- Re-tema só mudava `T.bg`/`T.lime`, não `T.surface` (usado por Sidebar/TopBar) — corrigido com
  derivação de superfícies a partir do bg (`lighten()`).
- Seletor de cor da barbearia no Onboarding (passo 2, "Cor primária"/"Cor de fundo") tinha o mesmo
  bug de origem do protótipo (`<div>` decorativa sem `<input type="file">`/`type="color"` por trás)
  — corrigido junto.
- Upload de logo (Onboarding passo 2) não abria seletor de arquivo — agora abre, aceita PNG/JPG/
  JPEG/SVG com preview e validação de tamanho (2MB). **Upload real pra armazenamento na nuvem ainda
  não existe** (Supabase Storage não configurado) — a tela deixa isso explícito, não finge persistir.

### ⏳ Sprint 7 — Impersonação ("Acessar como admin") — não iniciado
Elevação de privilégio — token de vida curta, log obrigatório, revisão de segurança dedicada antes
de shippar. Pode rodar independente dos sprints de billing.

### ⏳ Sprint 8 — Suporte — não iniciado
`SupportTicket` com RLS normal. Spike técnico necessário: leitura cross-tenant sob RLS normal (mesmo
padrão de soma por tenant já usado em todo o resto — não deveria precisar de `BYPASSRLS` dedicado
como o plano original cogitava, já que o mesmo mecanismo de `TenantContextService` resolve isso desde
o Sprint 2).

### ⏳ Sprint 9 — Releases — parcialmente feito
Configurações já está pronta (ver acima). Falta só `Release` (changelog, leitura manual, inserido
pelos devs a cada deploy).

### ⏳ Sprint 10 — Deploy — não iniciado
Deploy do `admin-desenvolvain` na Vercel, domínio `admin.barberaria.app`, `CORS_ORIGIN` de produção
atualizado na API.

## 7. Testes

Todo endpoint novo tem e2e cobrindo RBAC (403 pra não-super_admin) + a lógica específica (cálculo de
líquido do repasse, upsert de assinatura, validação de hex, etc.) — ver `apps/api/test/admin/`.
Suíte completa: 119/120 (a única falha é `connection-pool-leak.e2e-spec.ts`, flakiness pré-existente
do ambiente local, confirmada via `git stash` como não relacionada a nenhuma mudança deste projeto).

## 8. Riscos ainda vigentes

- **Repasses:** cálculo automático de receita/taxa continua fora de escopo até existir regra de
  negócio validada — o que existe hoje é só registro manual com a conta feita.
- **Impersonação (Sprint 7):** ainda não implementada — maior risco de segurança do que falta
  construir, não pular a revisão dedicada quando chegar a vez.
- **Upload de logo:** só client-side por enquanto (preview local), sem persistência — se isso virar
  prioridade, precisa de uma decisão de infra (Supabase Storage, presigned URL) antes de implementar,
  conforme seção 6.1.6 do `CLAUDE.md`.

---

*Atualizado em Agosto/2026 — Painel Master DesenvolvaIN.*
