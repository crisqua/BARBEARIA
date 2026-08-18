# Painel Master DesenvolvaIN
## Plano de build — do protótipo aprovado ao sistema real

---

## 1. Contexto

O protótipo visual (`desenvolvain-admin`, 11 telas, 100% mock) foi aprovado. Este documento é o plano
técnico para conectá-lo ao backend real do Barberaria (`apps/api`).

O backend já tem uma fatia real deste painel pronta e testada: `/v1/admin/tenants` (criar, listar,
detalhar, editar branding, suspender) e `/v1/admin/whoami`, atrás de `@Roles('super_admin')`, sem
tenant context (seção 6.4 do CLAUDE.md do backend). O protótipo vai muito além disso: catálogo de
planos, assinaturas recorrentes, MRR, repasse de receita, diretório de usuários cross-tenant, suporte
e changelog — nada disso existe no schema hoje, e parte é **explicitamente fora do MVP** na seção 4 do
CLAUDE.md (assinaturas/billing, dashboard financeiro avançado).

## 2. Decisão de escopo necessária

Sprints 1–3 são extensão segura do que já existe. A partir do **Sprint 4** entra billing —
recomendo tratar como iniciativa própria da incubadora, com aprovação explícita por sprint, não um
"sim" geral para os dez.

## 3. Arquitetura

`desenvolvain-admin` continua repositório separado, mesma stack (React+Vite), mesmo padrão de auth
(JWT em memória + refresh via cookie httpOnly, `apiFetch` idêntico ao de `painel-barbearia`). Cada
sprint troca uma fatia de dado mockado por uma chamada real. Todo endpoint novo segue o padrão de
`AdminTenantsController`: módulo NestJS próprio, `JwtAuthGuard`+`RolesGuard`, `@Roles('super_admin')`,
sem `TenantContextInterceptor`.

## 4. Modelo de dados novo (7 modelos Prisma, introduzidos incrementalmente)

| Modelo | tenant_id? | Nota |
|---|---|---|
| `Plan` | Não | Catálogo global de planos (código, preço, limites, módulos incluídos). |
| `Subscription` | Sim | Contrato tenant ↔ plano (status, ciclo, próxima cobrança). |
| `Payment` | Sim | Cobrança da assinatura. |
| `Payout` (Repasse) | Sim | Entrada manual até haver regra de cálculo definida. |
| `SupportTicket` | Sim | Chamado de suporte por tenant. |
| `Release` | Não | Changelog da plataforma. |
| `PlatformSettings` | Não | Singleton de configuração global. |

## 5. Estratégia de RLS

`tenants` já fica fora da RLS por design (Super Admin precisa ver todas as linhas de uma vez, o que
não combina com `current_setting` por transação — isolamento por rota+RBAC, não policy de banco).

| Tabela | RLS | Por quê |
|---|---|---|
| `Plan` | Isenta | Catálogo global, não é dado de tenant. |
| `Subscription` | Isenta (exceção documentada) | Gerida só pelo Super Admin; exposição futura ao tenant via `/v1/tenants/me/subscription` com filtro manual, mesmo padrão de `/v1/tenants/me`. |
| `Payment` | Isenta | Mesma razão de `Subscription`. |
| `Payout` | Isenta | Idem — sem motor automático no Sprint 6. |
| `SupportTicket` | **Normal** (policy padrão) | Faz sentido o tenant ver seus próprios tickets no futuro; leitura cross-tenant do Super Admin precisa de role Postgres com `BYPASSRLS` — spike no início do Sprint 8. |
| `Release` | Isenta | Changelog público. |
| `PlatformSettings` | Isenta | Singleton global. |

**Ação obrigatória no CI:** cada tabela isenta acima precisa entrar na whitelist do gate de RLS
(seção 5.5, `scripts/check-rls.sql`) no mesmo commit da migration, ou o build quebra.

## 6. Sprints

### Sprint 1 — Onboarding real + acerto de contrato (seguro)
Passo 1 do wizard só pede e-mail do admin; `CreateTenantDto.admin` exige `name`+`password` também.
- **Backend:** nenhuma mudança — `POST /v1/admin/tenants` já suporta tudo.
- **Frontend:** adicionar campos faltantes no passo 1; passo 4 chama `createTenant()` de verdade;
  Barbearias (lista+detalhe) trocam mock por `listTenants()`/`getTenant()`; "Suspender acesso" chama
  `updateTenant(id, { status })`.
- **Aceite:** criar barbearia pelo wizard gera tenant+admin real; lista reflete o banco.

### Sprint 2 — Dashboard real (parcial) (seguro)
- **Backend:** `GET /v1/admin/dashboard/overview` — total tenants por status, barbeiros ativos
  cross-tenant, agendamentos do mês cross-tenant. Via `this.prisma` direto (mesmo bypass de
  `AdminTenantsService`).
- **Frontend:** stats Barbearias/Barbeiros/Agendamentos reais; MRR/Churn com "em breve" até Sprint 6.
- **Aceite:** ações do Sprint 1 refletem nos números sem refresh manual.

### Sprint 3 — Usuários cross-tenant (seguro)
- **Backend:** `GET /v1/admin/users` — paginado, filtro role/tenant, join com `tenant.name`.
- **Frontend:** tela Usuários conectada.
- **Aceite:** criar profissional em qualquer painel-barbearia aparece na lista.

### Sprint 4 — Catálogo de Planos ⚑ requer confirmação
- **Schema:** migration `0005_add_plan_catalog` — tabela `plans`, sem tenant_id, sem RLS.
- **Backend:** `/v1/admin/plans` CRUD completo.
- **Frontend:** tela Planos & Preços conectada.
- **Decisão necessária:** confirmar os 4 planos, preços e limites reais — o protótipo tem valores
  de exemplo, não uma tabela de preços aprovada.

### Sprint 5 — Assinaturas + Onboarding completo ⚑ requer confirmação
- **Schema:** migration `0006_add_subscriptions` — tabela `subscriptions`, RLS-isenta.
- **Backend:** `/v1/admin/subscriptions` CRUD; `AdminTenantsService.create()` passa a criar a
  Subscription inicial na mesma transação.
- **Frontend:** passos 3 e 4 do Onboarding passam a persistir de verdade; tela Assinaturas conectada.
- **Aceite:** completar o wizard cria tenant+admin+assinatura numa única transação.

### Sprint 6 — Financeiro & Repasses ⚑⚑ requer regra de negócio
- **Schema:** migration `0007_add_payments` — `payments` e `payouts`, ambas RLS-isentas.
- **Backend:** MRR = `SUM(subscription.plan.priceCents) WHERE status='active'` (sem tabela nova);
  `/v1/admin/payments` e `/v1/admin/payouts` com registro manual, sem motor de cálculo automático.
- **Frontend:** Financeiro (MRR real + Pagamentos) e Repasses conectados, ambos manuais.
- **Não vou inventar a regra de repasse:** pressupõe a plataforma processando pagamento em nome da
  barbearia e devolvendo o líquido — precisa definir base de cálculo, %, meio de pagamento antes de
  automatizar.

### Sprint 7 — Impersonação ("Acessar como admin") ⚑ elevação de privilégio
Pode rodar em paralelo aos Sprints 4–6.
- **Backend:** `POST /v1/admin/tenants/:id/impersonate` — token de vida curta (~5min) para o admin
  do tenant; toda chamada logada em nova tabela `platform_activities`; sem refresh token de
  impersonação.
- **Frontend:** botão no detalhe da barbearia abre painel-barbearia numa aba nova com o token.
- **Antes de shippar:** revisão de segurança dedicada.

### Sprint 8 — Suporte (baixo risco)
- **Schema:** migration `0008_add_support_tickets` — RLS normal (seção 5.4).
- **Backend:** `/v1/admin/support/tickets`. Spike de 1–2h: leitura cross-tenant sob RLS normal via
  role Postgres com `BYPASSRLS` dedicado.
- **Frontend:** tela Suporte (leitura + status). Criação de ticket fica para quando painel-barbearia
  ganhar essa funcionalidade — fora deste plano.

### Sprint 9 — Releases & Configurações (baixo esforço)
- **Schema:** migration `0009_add_releases_and_settings` — `releases` e `platform_settings`.
- **Backend:** `/v1/admin/releases` (só leitura, inserido manualmente pelos devs a cada deploy),
  `/v1/admin/settings` (GET/PATCH da linha única).
- **Frontend:** ambas telas conectadas.

### Sprint 10 — Deploy
Deploy do `desenvolvain-admin` na Vercel, domínio `admin.barberaria.app`, `CORS_ORIGIN` de produção
atualizado na API.

## 7. Testes obrigatórios

Mesmo padrão de `apps/api/test/`, replicado por sprint que introduzir rota nova:
- **Sprints 1–3, 9, 10:** RBAC (role ≠ super_admin → 403), shape de resposta.
- **Sprints 4–6:** acima + criar assinatura com plano inexistente falha; cancelar assinatura não
  apaga tenant.
- **Sprint 7:** token de impersonação expira no tempo certo, não gera outro token, toda chamada
  grava em `platform_activities`.
- **Sprint 8:** isolamento completo da seção 7 do CLAUDE.md (itens 1–4) aplicado a `support_tickets`.

## 8. Riscos

- **Escopo:** Sprints 4–6 são, na prática, um segundo produto (billing da incubadora) crescendo no
  mesmo trimestre do MVP tenant-facing — tratar como iniciativa própria, não espremer na sequência
  original do CLAUDE.md.
- **Repasses:** maior risco do plano — é dinheiro saindo da plataforma pra terceiros. Não shippar
  cálculo automático sem regra de negócio validada.
- **Impersonação:** maior risco de segurança — token de vida curta, log obrigatório, sem exceção.

---

*Plano de projeto — Agosto/2026 — Painel Master DesenvolvaIN.*
