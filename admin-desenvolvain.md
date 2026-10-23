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

**Concluído e em produção local** (Sprints 1–6 + duas features extra fora da sequência original):
login de super_admin, CRUD de Barbearias, Onboarding completo (cria tenant + admin + assinatura numa
transação), Dashboard com métricas reais (tenants, barbeiros, agendamentos, MRR, trials), Usuários
cross-tenant, catálogo de Planos (trial/pro/enterprise), Assinaturas, Financeiro (MRR/ARR real +
registro manual de pagamentos) e Repasses (registro manual com cálculo de líquido). Configurações da
Plataforma também foi conectada (fora da sequência original de sprints, puxada pra frente porque a
tela já estava com bug visível) — domínio/e-mail/webhook/trial editáveis, e as cores de
fundo/acento re-temeiam o painel inteiro ao vivo. Atividade recente do Dashboard também foi trocada
de dado de exemplo pra feed real (`PlatformActivity`), e o wizard de Nova Barbearia ganhou validação
obrigatória por campo com bloqueio de avanço entre passos.

**Ainda mock/não construído:** Suporte, Releases, impersonação ("Acessar como admin"), deploy em
produção.

**Concluídas em 16/10/2026 — Sprints 7, 8 e 9** (seção 6): Dashboard, Usuários, Financeiro e
Assinaturas deixaram de somar dado de todas as barbearias cross-tenant, passaram a mostrar visão leve
da plataforma + detalhe sob demanda por barbearia selecionada. Motivado por `desempenho_barbearia.md`
(14/10/2026), que mediu 6 telas do painel passando de 1s com volume realista de barbearias. Cada
sprint validado com protótipo visual (canvas separado) antes de mexer no código real, implementado em
fases, testado (e2e + build) e confirmado em homolog.

**Fora da sequência de sprints, mesma motivação de desempenho:** tela **Barbearias** ganhou paginação
e busca reais no servidor (antes buscava até 50 de uma vez e tratava como lista completa, sem busca
além da página carregada) — não é um item numerado, é um ajuste pontual de uma tela que já existia
desde a Sprint 1.

**Sprint 10 (seção 6) — aguardando decisão, não iniciada:** eliminar o último loop cross-tenant que
sobrou (`getPerTenantSubscriptions`, base do MRR/Assinaturas) via função Postgres `SECURITY DEFINER`
— primeira exceção de RLS do projeto fora de `tenants`. Desenho pronto, falta confirmação explícita
antes de implementar.

**Sprint 11 (seção 6) — tentativa em 18/10/2026, não concluída, adiada pra quando Produção existir:**
região do banco longe da API em homolog (Render Oregon × Supabase Ohio) — confirmada como causa raiz
de nenhuma API de `painel-barbearia`/`cliente-app` se manter abaixo de 1s sob carga, nem as mais
simples. Tentativa de corrigir só em homolog não conseguiu mover a região (ver seção 6, detalhe
abaixo) — usuário decidiu deixar a correção de região de fato pra quando o ambiente de Produção for
criado.

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
| `PlatformActivity` | Sim | **Normal** | ✅ feature extra |
| `SupportTicket` | Sim | Normal (planejado) | ⏳ Sprint 13 |
| `Release` | Não | Isenta (planejado) | ⏳ Sprint 14 (parcial) |

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
GET   /v1/admin/activity                    — feed cross-tenant, ?limit= (padrão 10, máx 50)
```

## 6. Sprints

Índice de todas as sprints do projeto, de todos os apps — cada uma com seu app de origem na coluna
**Aplicativo**, pra não precisar de um documento por app. Detalhe completo de cada uma segue logo
abaixo, na mesma ordem.

| # | Aplicativo | Descrição | Status |
|---|---|---|---|
| 1 | Painel Master | Login funcional, Onboarding conectado (`createTenant()` real), CRUD de Barbearias (lista + detalhe + suspender) conectado | ✅ Concluído |
| 2 | Painel Master | `GET /dashboard/overview` somando tenants por status, barbeiros ativos, agendamentos do mês — cross-tenant, achado do `NOBYPASSRLS` | ✅ Concluído |
| 3 | Painel Master | `GET /admin/users` cross-tenant com filtro por role/tenant; super_admin sai direto, demais papéis somam por tenant | ✅ Concluído |
| 4 | Painel Master | Catálogo de 3 planos fixos (`trial`/`pro`/`enterprise`), `code` travado, resto (nome/preço/módulos) editável pela tela | ✅ Concluído |
| 5 | Painel Master | `Subscription` (RLS normal); Onboarding em 4 passos persiste tenant + admin + assinatura numa única transação | ✅ Concluído |
| 6 | Painel Master | MRR real (soma de planos ativos); `Payment`/`Payout` com registro manual, sem motor de cálculo automático | ✅ Concluído |
| 7 | Painel Master | Elimina o loop cross-tenant de Dashboard/Usuários; vira visão leve + drill-down por barbearia sob demanda (`GET /tenants/:id/stats`) | ✅ Concluído (16/10/2026) |
| 8 | Painel Master | `GET /admin/payments` cross-tenant removido; Financeiro vira por barbearia (dash do mês + histórico 3 meses + filtro Mês/Ano) | ✅ Concluído (16/10/2026) |
| 9 | Painel Master | `GET /admin/subscriptions` cross-tenant removido; resumo leve (4 cards) + gestão de 1 barbearia por vez (criar/trocar/cancelar plano) | ✅ Concluído (16/10/2026) |
| 10 | Painel Master | Elimina o último loop cross-tenant que sobrou (`getPerTenantSubscriptions`) via função Postgres `SECURITY DEFINER` — 1ª exceção de RLS fora de `tenants` | ⏳ Aguardando decisão |
| 11 | Infra/API | Render (Oregon) × Supabase (Ohio) confirmados como causa raiz: nenhuma API de `painel-barbearia`/`cliente-app` fica < 1s sob carga, nem as mais simples | ⏳ Aguardando decisão |
| 12 | Painel Master | "Acessar como admin" de uma barbearia — elevação de privilégio, token de vida curta, log obrigatório, revisão de segurança dedicada | ⏳ Não iniciado |
| 13 | Painel Master | `SupportTicket` com RLS normal — mesmo padrão de soma por tenant via `TenantContextService`, sem `BYPASSRLS` dedicado | ⏳ Não iniciado |
| 14 | Painel Master | Changelog manual (`Release`) — Configurações da Plataforma já está pronta, falta só essa parte | ⏳ Parcialmente feito |
| 15 | Painel Master | Deploy do `admin-desenvolvain` na Vercel, domínio `admin.barberaria.app`, `CORS_ORIGIN` de produção atualizado | ⏳ Não iniciado |
| 16 | App Cliente | Menu lateral (drawer) + histórico do cliente em primeiro plano na tela Início, reaproveitando filtros já existentes — só frontend | ✅ Concluído (16/10/2026) |
| 17 | App Cliente | Leva o menu lateral pra **todas** as telas do app (13 ao todo — exceto login/register/carregando, que não têm sessão ainda) — centraliza o Drawer dentro do `Phone` em vez de duplicar | ✅ Concluído (16/10/2026) |

### ✅ Sprint 1 — [Painel Master] Onboarding real + acerto de contrato
Login funcional, Onboarding conectado (`createTenant()` real), Barbearias (lista+detalhe+suspender)
conectada. `CreateTenantDto.admin` ganhou os campos que faltavam no protótipo.

### ✅ Sprint 2 — [Painel Master] Dashboard real (parcial)
`GET /v1/admin/dashboard/overview` — tenants por status, barbeiros ativos, agendamentos do mês, tudo
cross-tenant somando por tenant (achado do `NOBYPASSRLS` documentado na seção 4).

### ✅ Sprint 3 — [Painel Master] Usuários cross-tenant
`GET /v1/admin/users`, filtro por role/tenant. Super_admin sai direto (carve-out da migration 0002);
demais papéis somam por tenant.

### ✅ Sprint 4 — [Painel Master] Catálogo de Planos
**Decisão confirmada:** 3 planos — `trial`, `pro`, `enterprise` (sem "Starter", diferente do
protótipo original). `code` travado nesses 3 valores, resto editável pela tela.

### ✅ Sprint 5 — [Painel Master] Assinaturas + Onboarding completo
`Subscription` (RLS normal, ver seção 4). Onboarding completo: passo 1 usa planos reais, passo 3
mostra módulos do plano escolhido (só leitura), passo 4 persiste tenant+admin+assinatura numa
transação. Bug real corrigido em teste: `upsert` do Prisma quebrava com campo `undefined` no
`update` — trocado por create/update explícito.

### ✅ Sprint 6 — [Painel Master] Financeiro & Repasses
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

### ✅ Feature extra (fora da sequência) — Atividade recente
`PlatformActivity` (RLS normal, mesma categoria de `Subscription`/`Payment`/`Payout` — ver seção 4).
Eventos gravados na mesma transação da ação que os originou (nunca um passo separado que pode
dessincronizar): `tenant_created`/`tenant_suspended`/`tenant_reactivated` (`AdminTenantsService`),
`subscription_created`/`plan_changed` (`AdminSubscriptionsService`), `payment_registered`/
`payment_paid` (`AdminPaymentsService`), `payout_registered`/`payout_paid` (`AdminPayoutsService`).
Helper único (`activity-log.util.ts`) grava e formata os valores em R$ pt-BR. Leitura cross-tenant
soma por tenant via `TenantContextService`, mesmo padrão do resto do painel. **Ficam de fora de
propósito:** "Trial expirado" e "Suporte aberto" — nenhum dos dois tem regra de negócio ou módulo
implementado ainda (cron de expiração e `SupportTicket` do Sprint 13, respectivamente).

### ✅ Feature extra (fora da sequência) — Validação obrigatória no Onboarding
O wizard de Nova Barbearia deixava avançar de passo (via botão "Próximo" ou clicando direto numa
aba do step bar) sem nenhum campo preenchido — só o `criarBarbearia()` final validava (e só
slug/plano). Corrigido: passo 1 (nome, slug, nome do admin, e-mail, senha, plano) e passo 2 (cores
em hex válido) agora têm validação por campo, com mensagem inline. Navegação trocada de "pula pra
qualquer aba" pra "só alcança o passo N se todos os passos `1..N-1` estiverem válidos" — vale pro
botão Próximo e pro clique nas abas. E-mail validado no padrão `nome@dominio.tld` (regex simples,
mesmo nível de validação client-side que o resto do form — o backend continua sendo a fonte de
verdade via `class-validator` no DTO). `Input`/`Select` (componentes compartilhados, ~17 usos no
arquivo) ganharam prop `error` opcional, retrocompatível.

### ✅ Sprint 7 — [Painel Master] Performance: Dashboard e Usuários passam a ser por barbearia — concluído (16/10/2026)

**Motivação.** `desempenho_barbearia.md` (14/10/2026, relatório gerado em sessão separada via app)
mediu as 6 telas do painel que somam dado de **todas** as barbearias — Dashboard, Atividade,
Usuários, Assinaturas, Pagamentos, Repasses — e achou que todas passam de 1s com volume realista (55
barbearias simuladas). A causa é estrutural, não um bug pontual: `users`/`appointments`/
`subscriptions`/`payments`/`payouts`/`platform_activities` têm RLS forçado e a role de runtime
(`barberaria_app`) é `NOBYPASSRLS` de propósito (seção 4 deste documento) — não existe leitura
cross-tenant direta, só soma por tenant via `TenantContextService`, uma transação por barbearia. O
custo cresce linearmente com o número de barbearias cadastradas: quanto mais a plataforma vende, pior
essas telas ficam.

**Decisão de produto, não só de performance.** Em vez de atacar "somar tudo de todo mundo mais rápido"
(exigiria uma função `SECURITY DEFINER` bypassando RLS — avaliado e descartado por enquanto, é mudança
de estratégia de segurança que merece revisão própria se algum dia for necessária), o Dashboard e
Usuários mudam de escopo: o Super Admin não precisa de "total de agendamentos de todas as barbearias
somado", precisa de visão da plataforma (quantas barbearias, MRR, distribuição por plano) + poder
abrir o detalhe de UMA barbearia por vez, sob demanda. Padrão de referência: a tela "Vendas por
Pizzaria" já em produção no projeto irmão (`PIZZARIA`), que resolve exatamente esse mesmo problema do
mesmo jeito.

**Escopo fechado nesta conversa:**
- Dashboard deixa de somar profissionais ativos / agendamentos do mês / pagamentos pendentes de todas
  as barbearias juntas.
- MRR e o gráfico "Barbearias por Plano" reaproveitam o cache de 90s que `GET /v1/admin/subscriptions`
  já mantém — nenhuma tabela nova, nenhuma mudança de RLS.
- **Atividade recente sai do Dashboard** (confirmado) — era uma das 6 telas lentas do relatório e não
  estava coberta por este sprint; em vez de deixar embutida e aceitar que continua lenta, sai da tela
  principal. Não tem substituto definido ainda — fica de fora por enquanto, não é regressão escondida,
  é decisão explícita.
- Usuários deixa de ser item fixo do menu lateral (sidebar) — remove de `NAV` em `App.jsx`. Acesso
  passa a ser só pelo botão **"Ir para Barbearias"** no Dashboard (nome confirmado — não "Ir para
  Usuários", porque a tela é sobre a barbearia, usuários é só uma parte do que ela mostra).
- Usuários passa a exigir escolher 1 barbearia antes de listar (hoje lista cross-tenant por padrão).
- Tela de drill-down por barbearia mostra: agendamentos do mês, profissionais (ativos **e** inativos,
  contados separado — mesmo padrão visual que o card "Barbearias" do Dashboard já usa, total + "X
  ativos · Y inativos"), clientes cadastrados, gráfico de agendamentos dos últimos 6 meses — **sem
  faturamento/ticket médio**. Decisão explícita: isso seria um primeiro passo em "dashboard financeiro
  avançado", que a seção 4 do `CLAUDE.md` marca fora do MVP de propósito.
- **Novo, achado durante o protótipo:** a lista de usuários do drill-down ganha busca por nome e
  paginação (3 por página na prova visual; valor real a decidir na implementação).
- **Gráficos sem biblioteca nova** (confirmado) — SVG desenhado à mão, consistente com o resto do
  monorepo (`painel-barbearia`/`cliente-app` também não usam nenhuma).
- **Fora de escopo deste sprint:** exportar CSV com todas as barbearias (pedido à parte, usuário ainda
  vai definir o layout — ver seção de riscos/pendências se isso avançar depois).

**Achado que simplifica o backend.** `GET /v1/admin/users` já aceita `?tenantId=`
(`admin-users-query.dto.ts`) e, quando usado, já abre só 1 transação em vez do loop cross-tenant — a
tela Usuários resolve majoritariamente com mudança de frontend, sem endpoint novo pra listar usuários.

**Backend:**
| Arquivo | Mudança |
|---|---|
| `admin-dashboard.service.ts` | Alterado — remove o loop `mapWithConcurrency` sobre profissionais/agendamentos/pagamentos; MRR e `trialsAtivos` passam a vir do mesmo cache de `AdminSubscriptionsService` em vez de buscar `Subscription` de novo por tenant |
| `admin-subscriptions.service.ts` | Alterado — expõe a contagem de barbearias por plano em cima do array que `list()` já lê do cache (sem nova leitura ao banco) |
| `admin-tenants.service.ts` | Alterado — método novo `getStats(tenantId)`: 1 `runInTenantContext`, devolve agendamentos do mês, profissionais ativos e inativos (contagem separada), clientes cadastrados, série de 6 meses |
| `admin-tenants.controller.ts` | Alterado — rota nova `GET /v1/admin/tenants/:id/stats` |
| `admin-users-query.dto.ts` | Alterado — campo novo `name` (busca parcial, opcional) |
| `admin-users.service.ts` | Alterado — filtro por `name` (case-insensitive, `contains`) quando informado |
| `test/admin/admin-tenants-stats.e2e-spec.ts` | **Novo** — RBAC (403 não-super_admin) + isolamento (stats de uma barbearia não vazam dado de outra) |

**Frontend (`apps/admin-desenvolvain/src/App.jsx`):**
| Componente | Mudança |
|---|---|
| `NAV` (~L267) | Alterado — remove o item "Usuários" da seção Plataforma |
| `Dashboard` (~L426) | Alterado — remove cards de Barbeiros na rede/Agendamentos por mês/Churn e o painel de Atividade recente; adiciona gráfico "Barbearias por Plano"; adiciona botão "Ir para Barbearias" |
| `Usuarios` (~L1370) | Alterado — adiciona seletor de barbearia; só busca depois de selecionar; adiciona cards de stats (profissionais com detalhamento ativos/inativos) + gráfico de 6 meses; adiciona campo de busca por nome + paginação acima/abaixo da lista |
| `src/api/client.js` | Alterado — função nova `getTenantStats(tenantId)`; `getUsers()` passa `name` como mais um parâmetro de query quando presente |

Sem extração pra arquivo novo por enquanto (os componentes continuam dentro de `App.jsx`, mesmo
padrão do resto do arquivo — seção 10 do `CLAUDE.md` pede extração incremental, não reescrita).

**Protótipo visual aprovado** (canvas separado, não é código do app) cobrindo as duas telas com dado
fictício — usado pra validar o layout e fechar as decisões acima antes de mexer no código real.

**Plano de implementação, em fases (ordem de execução):**

1. **Busca por nome em Usuários** (menor risco, aditivo) — `admin-users-query.dto.ts` ganha campo
   `name` opcional validado; `admin-users.service.ts` filtra por `contains` case-insensitive quando
   informado.
2. **Endpoint novo de stats por barbearia** — `admin-tenants.service.ts` ganha `getStats(tenantId)` (1
   `runInTenantContext`: agendamentos do mês, `profissionaisAtivos`/`profissionaisInativos` separados,
   clientes cadastrados, série dos últimos 6 meses); rota nova `GET /v1/admin/tenants/:id/stats` em
   `admin-tenants.controller.ts`; teste novo `test/admin/admin-tenants-stats.e2e-spec.ts` (RBAC +
   isolamento + conferência dos números).
3. **Dashboard simplificado** — `admin-subscriptions.service.ts` expõe `tenantsByPlan:
   [{planCode, planName, count}]` em cima do array que `list()` já lê do cache (sem nova leitura ao
   banco); `admin-dashboard.service.ts` remove o loop `mapWithConcurrency` pesado, MRR/trials/
   distribuição por plano passam a vir desse cache.
   - **Ajuste necessário no teste existente** (`admin-dashboard.e2e-spec.ts`, achado ao revisar antes
     de planejar): remove as asserções de `barbersActive`/`appointmentsThisMonth` (campos que deixam
     de existir na resposta); o teste "reflete uma assinatura ativa no MRR" cria a assinatura direto
     via `tx.subscription.create()` (Prisma puro), o que **nunca invalida o cache de Assinaturas** —
     depois da mudança isso cairia na mesma armadilha de cache do incidente de setembro (dado
     desatualizado). Troca pra criar a assinatura via `PATCH /v1/admin/tenants/:id/subscription` (já
     invalida o cache certo), que também é mais fiel a como uma assinatura nasce de verdade no sistema.
4. **Cliente de API** — `src/api/client.js` ganha `getTenantStats(tenantId)`; `getUsers()` passa `name`
   como parâmetro de query quando presente.
5. **Dashboard (frontend)** — remove "Usuários" de `NAV`; `Dashboard` perde os cards antigos e o painel
   de Atividade recente, ganha o gráfico "Barbearias por Plano" (SVG) e o botão "Ir para Barbearias".
6. **Usuários/drill-down (frontend)** — `Usuarios` ganha seletor de barbearia, cards de stats
   (profissionais ativos/inativos separados), gráfico de 6 meses (SVG), busca por nome, paginação e a
   lista de usuários.
7. **Verificação** — suíte e2e completa (`--runInBand`), zero regressão esperada; smoke test manual no
   painel local se o backend estiver de pé.

### ✅ Sprint 8 — [Painel Master] Financeiro por barbearia (drill-down, mesmo padrão da Sprint 7) — concluído (16/10/2026)

**Motivação:** o relatório de desempenho (`desempenho_barbearia.md`, item 3.2) lista `GET
/v1/admin/payments` entre as telas cross-tenant que crescem com o número de barbearias (1.133ms sem
cache / 2ms com cache, TTL de 90s hoje escondendo o problema, não resolvendo). A Sprint 7 já aplicou
o padrão "escolhe uma barbearia, consulta só ela" em Dashboard/Usuários — esse sprint estende o mesmo
padrão pra tela Financeiro (hoje "Receita & MRR"), fechando a lista de telas lentas junto com
Dashboard/Usuários (restam fora desse padrão: Atividade recente e Assinaturas — cache de 90s
aceito por ora; Repasses tem problema de modelo de negócio registrado à parte na seção 8, não é
questão de desempenho).

**Decisão de produto, confirmada na conversa (2026-10-16):** a tela deixa de mostrar MRR/ARR/Trials
cross-tenant (hoje redundante — o Dashboard já cobre MRR desde a Sprint 7) e passa a trabalhar sobre
**uma barbearia selecionada por vez**, com três blocos:
1. **Dash do mês atual** — "pago este mês" / "pendente este mês", calculado em cima da mesma lista
   de pagamentos que a tela já busca pra essa barbearia (sem endpoint nem query adicional só pra isso).
2. **Registrar pagamento** — mesmo formulário de hoje, menos o campo "Barbearia" (a barbearia já vem
   pré-selecionada pela tela; deixa de fazer sentido escolher de novo dentro do formulário).
3. **Histórico de pagamentos** — mostra por padrão só os 3 meses mais recentes; pra consultar período
   mais antigo, filtro por Mês + Ano (dois `<select>` custom-estilizados — não o `<input
   type="month">` nativo, testado no protótipo e descartado por estética inconsistente com o resto do
   painel) exibindo um resumo (total pago/pendente) do período filtrado.

**Navegação:** o botão "Ver financeiro desta barbearia →" na tela Usuários (drill-down da Sprint 7)
leva pra Financeiro com a barbearia já selecionada, sem pedir de novo. No protótipo (canvas separado,
arquivos `.dc.html` isolados sem state compartilhado nativo) isso precisou de um contorno via
`localStorage` lido a cada render; **no app real isso não se aplica** — `Usuarios` e `Financeiro` são
componentes dentro da mesma árvore React de `App.jsx`, então a barbearia selecionada é só um state
comum levantado pro componente `App` (`financeiroTenantId` + setter, passados como prop pros dois
componentes), sem localStorage nem hash.

**Protótipo visual aprovado** (canvas separado, não é código do app, mesmo espírito do protótipo da
Sprint 7) cobrindo a jornada completa — seleção de barbearia, dash do mês, registro de pagamento,
histórico com filtro Mês/Ano — usado pra validar o layout e fechar as decisões acima antes de mexer
no código real.

**Decisão confirmada (2026-10-16):** `GET /v1/admin/payments` (cross-tenant) será **removido**, não
mantido — fica sem nenhum consumidor depois dessa mudança (único uso era `Financeiro` via
`listPayments()`, que deixa de existir). Confirmado com o grep: nenhum outro lugar do frontend chama
isso. Três pontos além do controller/service que também referenciam esse endpoint e precisam ser
limpos junto (achado ao conferir antes de planejar a fase 1):
- `admin-payments.service.ts` — método `list()` (cross-tenant, cacheado) inteiro sai, junto com
  `assertTenantExists` se não for mais usado por mais nada depois da remoção (conferir).
- `admin-payments.controller.ts` — rota `@Get('admin/payments')` sai.
- `test/admin/admin-payments.e2e-spec.ts` — bloco de teste que teste esse `GET` (em torno da linha 85)
  sai; o describe do arquivo cita os dois endpoints no título, ajustar.
- `scripts/benchmark/bench.mjs` — linha que mede `GET /v1/admin/payments` (usada no relatório de
  desempenho) sai, já que o endpoint deixa de existir; `desempenho_barbearia.md` fica com uma nota
  histórica (a métrica existiu, motivou esse sprint, não existe mais pra remedir).
- `src/api/client.js` — `listPayments()` sai; `App.jsx` perde o `import { listPayments }`.

**Arquivos — Backend:**

| Arquivo | Mudança |
|---|---|
| `admin-payments.service.ts` | Novo método `listForTenant(tenantId, query?)` — 1 `runInTenantContext`, sem cache (já rápido, consulta só 1 tenant, mesmo raciocínio do `getStats` da Sprint 7) |
| `admin-payments.controller.ts` | Rota nova `GET /v1/admin/tenants/:tenantId/payments` |
| `test/admin/admin-payments.e2e-spec.ts` | Testes novos pra `listForTenant`: RBAC (403 não-super_admin), isolamento (barbearia A não vê pagamento de B), paginação |

Sem mudança de schema/migration — `Payment` já tem `period` (formato `AAAA-MM`), suficiente pro
filtro Mês/Ano sem campo novo.

**Arquivos — Frontend:**

| Arquivo | Mudança |
|---|---|
| `src/api/client.js` | `getTenantPayments(tenantId)` novo |
| `App` (componente raiz) | State novo `financeiroTenantId` + setter, passado como prop pra `Usuarios` e `Financeiro` |
| `Usuarios` | Botão "Ver financeiro desta barbearia →" chama o setter antes de navegar pra Financeiro |
| `Financeiro` | Reescrito: seletor de barbearia (pré-preenchido quando vem de Usuários, mesmo padrão de `<select>` da Sprint 7), dash do mês atual, formulário de registro sem campo Barbearia, histórico 3 meses + filtro Mês/Ano com resumo do período |
| `NAV` | Label "Receita & MRR" → "Financeiro" (mesmo id/rota — ao contrário de Usuários na Sprint 7, o item continua no menu) |

**Plano de implementação, em fases (ordem de execução):**

1. **Endpoint novo de pagamentos por barbearia** (backend) — `listForTenant` em
   `admin-payments.service.ts`, rota em `admin-payments.controller.ts`, testes de RBAC + isolamento
   em `admin-payments.e2e-spec.ts`.
2. **Cliente de API + state compartilhado** — `getTenantPayments` em `client.js`; state
   `financeiroTenantId` levantado pro `App`, passado pros dois componentes.
3. **Financeiro (frontend), reescrita completa** — seletor de barbearia, dash do mês, formulário sem
   campo Barbearia, histórico com filtro Mês/Ano e resumo de período, seguindo o protótipo aprovado.
4. **Usuários (frontend), ajuste pequeno** — botão "Ver financeiro desta barbearia →" setando o
   state compartilhado antes de navegar.
5. **Verificação** — suíte e2e completa (`--runInBand`), zero regressão esperada; smoke test manual
   no painel local.

### ✅ Sprint 9 — [Painel Master] Assinaturas por barbearia (drill-down, mesmo padrão da Sprint 7/8) — concluído (16/10/2026)

**Motivação:** mesmo problema de `GET /v1/admin/payments` antes da Sprint 8 — `GET
/v1/admin/subscriptions` (`admin-subscriptions.service.ts`, método `list()`) faz um loop cross-tenant
(`mapWithConcurrency`, 1 `runInTenantContext` por barbearia) pra montar uma tabela com as 56
barbearias de uma vez. Medido em `desempenho_barbearia.md`: 1.415ms sem cache / 2ms com cache (90s de
TTL escondendo o problema, não resolvendo). Único consumidor é a tela `Assinaturas` — confirmado por
grep, igual se confirmou pra Payments antes da Sprint 8.

**Diferença importante em relação à Sprint 8: o back-end tenant-scoped já existe.** `GET
/v1/admin/tenants/:tenantId/subscription` e `PATCH /v1/admin/tenants/:tenantId/subscription` (troca
de plano e cancela/reativa, via `status`) já estão prontos em `admin-subscriptions.controller.ts` —
não precisam de rota nova. O trabalho de back-end deste sprint é bem menor que o da Sprint 8: só
remover o `list()` cross-tenant e adicionar um resumo leve no lugar dele.

**Decisão de produto:** a tela para de listar as 56 barbearias numa tabela só e passa a ter dois
blocos:
1. **Resumo global, leve** — "Ativas" / "Canceladas" / "Sem assinatura" / "MRR", os 4 cards que já
   existem hoje. Continuam cross-tenant (fazem sentido como visão geral), mas deixam de custar uma
   consulta por barbearia: `AdminSubscriptionsService.getOverview()` (criado na Sprint 7 pro
   Dashboard, já lê do mesmo cache de 90s que o `list()` usava) ganha 3 contagens novas
   (`activeCount`/`cancelledCount`/`noneCount`) em cima do MESMO array já cacheado — nenhuma consulta
   nova ao banco, só mais uns `.filter().length` em memória.
2. **Gestão de uma barbearia por vez** — seletor de barbearia (mesmo padrão de `<Select>` de
   Usuários/Financeiro) e, abaixo, o plano atual dela, status, data de início, um `<select>` pra trocar
   de plano e o botão cancelar/reativar — usando os endpoints tenant-scoped que já existem.

**Como vai ficar a tela (descrição, mesma linguagem visual já usada em Usuários/Financeiro — não
precisa de protótipo novo, o padrão já está validado e no ar):**

```
Assinaturas
Veja e altere o plano de uma barbearia

┌───────────┐ ┌────────────┐ ┌─────────────────┐ ┌─────────┐
│ ATIVAS    │ │ CANCELADAS │ │ SEM ASSINATURA   │ │ MRR     │
│   56      │ │     0      │ │       0          │ │ R$ 0,00 │
└───────────┘ └────────────┘ └─────────────────┘ └─────────┘

                                    [ Selecione uma barbearia… ▾ ]

  (sem seleção)
  ┌─────────────────────────────────────────────────────────┐
  │ Selecione uma barbearia acima pra ver e alterar o plano. │
  └─────────────────────────────────────────────────────────┘

  (selecionada, sem assinatura ainda — tenant criado antes da Sprint 5)
  ┌─────────────────────────────────────────────────────────┐
  │ Essa barbearia ainda não tem assinatura.                 │
  │ [ Selecione um plano ▾ ]   [ Criar assinatura ]          │
  └─────────────────────────────────────────────────────────┘

  (selecionada, com assinatura)
  ┌─────────────────────────────────────────────────────────┐
  │ Plano atual: PRO        Status: ATIVO                    │
  │ Assinante desde: 22 de set. de 2026                      │
  │                                                           │
  │ [ Trocar plano ▾ ]              [ Cancelar assinatura ]  │
  └─────────────────────────────────────────────────────────┘
```

Os 4 cards do topo ficam sempre visíveis (não dependem da barbearia selecionada) — só a seção de
baixo muda com o seletor, igual já acontece em Usuários e Financeiro.

**Decisão confirmada (2026-10-16):** sim, entra botão "Ver assinatura desta barbearia →" — em **Usuários**
(ao lado do já existente "Ver financeiro desta barbearia →", Sprint 8) e em **Financeiro** também.
Mesmo mecanismo de state levantado pro `App` da Sprint 8, só que com uma chave própria
(`assinaturasTenantId` + setter) em vez de reaproveitar `financeiroTenantId` — os três destinos
(Financeiro, Assinaturas) são decisões de navegação independentes a partir de Usuários/Financeiro;
uma seleção feita pensando em "ver o financeiro" não deveria pré-popular "ver a assinatura" de um
jeito que o usuário não pediu.

**Arquivos — Backend:**

| Arquivo | Mudança |
|---|---|
| `admin-subscriptions.service.ts` | `getOverview()` ganha `activeCount`/`cancelledCount`/`noneCount` (mesmo array já cacheado); método `list()` removido (sem consumidor depois da mudança) |
| `admin-subscriptions.controller.ts` | Rota `GET admin/subscriptions` removida; rota nova `GET admin/subscriptions/overview` chamando `getOverview()` |
| `test/admin/admin-subscriptions.e2e-spec.ts` | Teste da linha ~109 ("lista cross-tenant paginada") trocado por teste do `/overview` (contagens corretas); RBAC do endpoint novo |
| `admin-dashboard.service.ts` | Sem mudança — já chama `getOverview()` internamente, os campos novos só passam a existir no retorno do método, Dashboard ignora o que não usa |
| `scripts/benchmark/bench.mjs` | Linha de `GET /v1/admin/subscriptions` trocada por `GET /v1/admin/subscriptions/overview` |

Sem migration — nenhum campo novo de schema, só contagem em cima do que já existe.

**Arquivos — Frontend:**

| Arquivo | Mudança |
|---|---|
| `src/api/client.js` | `listSubscriptions` sai; entram `getSubscriptionsOverview()` e `getTenantSubscription(tenantId)` (esse último faltava — só existia `updateTenantSubscription`) |
| `App` (componente raiz) | State novo `assinaturasTenantId` + setter, passado pra `Usuarios`, `Financeiro` e `Assinaturas` |
| `Usuarios` | Botão "Ver assinatura desta barbearia →" (ao lado do "Ver financeiro…" da Sprint 8) |
| `Financeiro` | Botão "Ver assinatura desta barbearia →" novo |
| `Assinaturas` | Reescrita: 4 cards do resumo (via `getSubscriptionsOverview`) + seletor de barbearia (pré-preenchido quando vem de Usuários/Financeiro) + painel de uma barbearia (via `getTenantSubscription`/`updateTenantSubscription`, já existente) |

**Plano de implementação, em fases (ordem de execução):**

1. **Resumo cross-tenant mais barato** (backend) — `getOverview()` ganha as 3 contagens novas; rota
   `GET admin/subscriptions/overview`; ajusta e adiciona testes.
2. **Remove o `list()` cross-tenant** (backend) — remove método, rota e o teste antigo que dependia
   dele; atualiza benchmark.
3. **Cliente de API + state compartilhado** (frontend) — `getSubscriptionsOverview`,
   `getTenantSubscription` em `client.js`; state `assinaturasTenantId` levantado pro `App`.
4. **Assinaturas (frontend), reescrita completa** — cards + seletor + painel de uma barbearia.
5. **Botões em Usuários e Financeiro** — "Ver assinatura desta barbearia →" setando o state
   compartilhado antes de navegar, mesmo padrão do botão de Financeiro da Sprint 8.
6. **Verificação** — suíte e2e completa (`--runInBand`), zero regressão esperada; smoke test manual.

### ⏳ Sprint 10 — [Painel Master] Performance do Dashboard/Assinaturas: função SECURITY DEFINER — aguardando decisão

**Motivação:** mesmo depois das Sprints 7-9 (que já eliminaram os loops cross-tenant de
Dashboard/Usuários/Financeiro/Pagamentos/Assinaturas), continua sobrando **um** loop cross-tenant:
`AdminSubscriptionsService.getPerTenantSubscriptions()` — base de `getOverview()`, usado tanto pelo
Dashboard quanto pela tela Assinaturas. Com RLS forçado em `subscriptions` e a role de runtime
(`barberaria_app`) sendo `NOBYPASSRLS` de propósito, ler a assinatura de cada barbearia exige abrir
**uma transação por tenant** (`runInTenantContext`, `mapWithConcurrency` 5 por vez) — com 56
barbearias em homolog, isso mede 5-6s toda vez que o cache de 90s está frio (primeira carga depois
de um deploy, já que homolog roda cache em memória, sem Redis — ver seção 8). Achado ao investigar
por que o Dashboard "demora na primeira vez" (conversa de 16/10/2026).

**Decisão de produto/segurança, ainda não confirmada:** a correção de verdade (1 query em vez de 56)
exige uma **função Postgres `SECURITY DEFINER`** — primeira exceção de bypass de RLS do projeto além
da já documentada em `tenants` (seção 6.4 do `CLAUDE.md`). Duas alternativas mais fracas foram
descartadas por não resolverem a causa raiz, só escondê-la ou adiá-la:
- Aumentar a concorrência do `mapWithConcurrency` (5 → 10-15): reduz o tempo proporcionalmente, mas
  tem teto (estoura o pool de conexões do Supavisor) e não elimina o problema, só ameniza.
- Aquecer o cache no boot do servidor: esconde o custo do primeiro usuário, mas continua pagando as
  56 transações, só que em background — não é correção, é disfarce.

**Desenho da função** (detalhado na conversa de 16/10/2026, não implementado ainda):

```sql
-- Role dedicada, SEM login, só com BYPASSRLS — não reaproveita o superuser de
-- migration (DIRECT_URL). Minimiza o raio de impacto: se a função tiver um bug,
-- o pior cenário é "lê mais do que devia", nunca escreve/apaga em tabela nenhuma.
CREATE ROLE barberaria_admin_reader NOLOGIN NOSUPERUSER BYPASSRLS;

CREATE OR REPLACE FUNCTION admin_subscriptions_overview()
RETURNS TABLE (
  tenant_id uuid, tenant_name varchar, tenant_slug varchar,
  subscription_status varchar, plan_code varchar, plan_name varchar, plan_price_cents integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.slug, s.status, p.code, p.name, p.price_cents
  FROM tenants t
  LEFT JOIN subscriptions s ON s.tenant_id = t.id
  LEFT JOIN plans p ON p.id = s.plan_id
  ORDER BY t.created_at DESC;
$$;

ALTER FUNCTION admin_subscriptions_overview() OWNER TO barberaria_admin_reader;
REVOKE ALL ON FUNCTION admin_subscriptions_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_subscriptions_overview() TO barberaria_app;
```

Só `SELECT` — nunca escreve, de propósito (um bypass de RLS numa função que também gravasse seria um
risco bem maior, poderia escrever na barbearia errada). Chamada via `prisma.$queryRaw` dentro de
`getPerTenantSubscriptions()`, fora de qualquer `runInTenantContext` (mesma categoria de leitura
direta que `tenants` já usa, seção 6.4) — resto do método (cache de 90s, agregações de `getOverview()`)
não muda.

**Arquivos (se confirmado):**

| Arquivo | Mudança |
|---|---|
| Migration nova | `CREATE ROLE barberaria_admin_reader`, a função, grants — com comentário explicando a exceção |
| `admin-subscriptions.service.ts` | `getPerTenantSubscriptions()` troca o loop por 1 `$queryRaw` |
| `CLAUDE.md` / `admin-desenvolvain.md` | Documentar como segunda exceção de RLS do projeto, ao lado de `tenants` |
| CI (seção 5.5) | Sem mudança necessária — o gate verifica `relrowsecurity` de tabela, isso não mexe em RLS de tabela nenhuma |

**Em aberto — decidir antes de implementar:** confirmar que esse é o caminho (função
`SECURITY DEFINER` com role dedicada) e não uma das alternativas mais fracas — é a primeira vez que o
projeto introduz um bypass de RLS fora de `tenants`, decisão que o próprio `CLAUDE.md` pede pra
parar e confirmar antes de agir (seção 10). Não iniciado até essa confirmação.

### ⏳ Sprint 11 — [Infra/API] Infra: região do banco longe da API (homolog) — tentativa não concluída

**Motivação:** avaliação de desempenho das APIs de "cliente barbearia" (`painel-barbearia` +
`cliente-app` — não o Painel Master, que é escopo das Sprints 7-10) feita em 16/10/2026, medindo
direto contra o homolog real (não só o benchmark local simulado de `desempenho_barbearia.md`).
Resultado, com dyno já aquecido (sem cold start):

| Rota | Isolada | 5 simultâneas (p50 / máx) | < 1s? |
|---|---|---|---|
| `POST /v1/auth/login` | 2,4-2,8s | **7,10s / 8,48s** | ❌ |
| `GET /v1/services` | — | 1,43s / 1,48s | ❌ |
| `GET /v1/professionals/:id/availability` | — | 1,16s / 1,51s | ❌ |
| `GET /v1/professionals` | — | 1,10s / 1,14s | ❌ |
| `GET /v1/appointments` | — | 0,75s / 1,20s | ❌ (mediana ok, pico estoura) |
| `GET /v1/users/me` | — | 0,63s / 1,39s | ❌ (mediana ok, pico estoura) |
| `GET /v1/tenants/me` | 0,54s | — | ✅ |

**Nenhuma API do `cliente-app` se mantém confiavelmente abaixo de 1s sob carga, nem com só 5
requisições simultâneas** — o mesmo nível mínimo que o benchmark do próprio projeto usa.

**Causa raiz confirmada:** `apps/api/render.yaml` tem `region: oregon` (EUA, costa oeste); o Supabase
de homolog está em `us-east-2`, Ohio (EUA, costa leste) — travessia real costa-a-costa, pior que o
cenário "produção estimada" (20ms RTT) que o `desempenho_barbearia.md` original usou pra dar `✅` na
maioria das rotas. Já era um risco **registrado** nesse relatório (seção 3.5, "a região do banco é
decisiva") — essa medição confirma que é real, não hipotético, e que piora sob concorrência (CPU
compartilhada do plano Render + pool de conexões do Supabase, não só rede).

**Amplificador arquitetural, não é bug:** cada rota de tenant faz 4-5 idas e voltas ao banco (abre
transação, `set_config` do RLS, consulta, fecha — mecanismo de segurança da seção 6.3 do `CLAUDE.md`,
não deve ser removido). Com RTT baixo isso é barato; com a distância real Oregon↔Ohio, multiplica o
problema.

**Achado à parte, não depende da região:** o login sob concorrência (7-8,5s) pode também esbarrar no
`UV_THREADPOOL_SIZE` padrão do Node (4 threads) — bcrypt nativo roda nessas threads, a 5ª chamada
simultânea fica na fila. Vale investigar como ajuste de configuração independente da decisão de
região.

**Em aberto — decidir antes de implementar:** mover um dos dois serviços pra mesma região (Render
pra perto do Supabase, ou vice-versa). Usuário optou por avaliar depois ("verei depois", 16/10/2026)
— não iniciado. Relevante também pra Produção, que ainda nem foi provisionada (seção 9) — a mesma
decisão de região deveria valer desde a criação do ambiente de Produção, não só corrigir homolog.

**Tentativa em homolog (18/10/2026), não concluída:** confirmado com o usuário que mover o Supabase
de região exige recriar o projeto do zero (migrar schema, dados e Storage) — bem mais custoso que
mover o Render, que é stateless. Na tentativa de criar o serviço novo do Render em Ohio, o usuário
**renomeou o serviço existente** (`barberaria-api` → `barberaria-api-homolog`) em vez de criar um
serviço novo — a região não mudou (confirmado na tela do Render: `Region: Oregon`), porque o Render
**não permite trocar a região de um serviço já existente**, nem através do seletor de região que
aparece nas Settings dele (o usuário relatou ter selecionado Ohio ali e mesmo assim permaneceu
Oregon — o seletor não tem efeito nesse caso, região só é aplicada na criação de um serviço novo).
Os 3 frontends (`cliente-app`, `painel-barbearia`, `admin-desenvolvain`) já foram repontados pra
`barberaria-api-homolog.onrender.com` e validados funcionando (login + chamadas autenticadas
confirmadas via DevTools Network) — então o rename/repoint ficou concluído e é seguro, só não resolve
o problema de latência, já que a API continua em Oregon. **Decisão:** não tentar de novo em homolog;
a correção de região de verdade (criar o serviço do zero já escolhendo Ohio na tela de criação, antes
de clicar em criar — não dá pra corrigir depois) fica pra quando o ambiente de Produção for criado.

### ⏳ Sprint 12 — [Painel Master] Impersonação ("Acessar como admin") — não iniciado
Elevação de privilégio — token de vida curta, log obrigatório, revisão de segurança dedicada antes
de shippar. Pode rodar independente dos sprints de billing.

### ⏳ Sprint 13 — [Painel Master] Suporte — não iniciado
`SupportTicket` com RLS normal. Spike técnico necessário: leitura cross-tenant sob RLS normal (mesmo
padrão de soma por tenant já usado em todo o resto — não deveria precisar de `BYPASSRLS` dedicado
como o plano original cogitava, já que o mesmo mecanismo de `TenantContextService` resolve isso desde
o Sprint 2).

### ⏳ Sprint 14 — [Painel Master] Releases — parcialmente feito
Configurações já está pronta (ver acima). Falta só `Release` (changelog, leitura manual, inserido
pelos devs a cada deploy).

### ⏳ Sprint 15 — [Painel Master] Deploy — não iniciado
Deploy do `admin-desenvolvain` na Vercel, domínio `admin.barberaria.app`, `CORS_ORIGIN` de produção
atualizado na API.

### ✅ Sprint 16 — [App Cliente] Tela Início: menu lateral + histórico em primeiro plano — concluído (16/10/2026)

**Motivação:** a tela Início de hoje (`apps/cliente-app/src/App.jsx`, `screen === "home"`) é só um
bloco de marca (logo/nome) + botão grande "Agendar Horário" + dois cards ("Profissionais" / "Meus
Agendamentos"). Pra quem já é cliente da barbearia, não mostra nada sobre o que a pessoa já fez ou tem
marcado — o histórico fica escondido atrás de 2 cliques ("Meus Agendamentos" → "Meus Históricos").
Pedido do usuário (16/10/2026): tela mais moderna, com menu lateral de verdade (em vez de só 2 cards
soltos) e o histórico do cliente aparecendo logo de cara.

**Decisão de produto, confirmada na conversa:**
1. **Menu lateral (drawer)** — abre pelo ícone de hambúrguer no canto superior esquerdo, cobre a tela
   com um painel deslizante à esquerda (fecha tocando fora ou no próprio item "Sair"). Itens: Início,
   Agendar Horário, Profissionais, Meus Agendamentos, Horários de Funcionamento, Sair — mesmo
   conjunto de destinos que já existem hoje como telas separadas, só que acessíveis de um menu em vez
   de 2 cards na Início.
2. **Histórico em primeiro plano** — a tela Início passa a abrir mostrando: um card em destaque com o
   **próximo agendamento** (se houver), depois a lista de **histórico** (concluídos/cancelados, mais
   recentes primeiro). "Agendar Horário" continua acessível, mas vira um botão secundário (outline),
   não é mais o elemento dominante da tela.
3. Header compacto no topo (avatar + saudação + nome da barbearia), substituindo o bloco centralizado
   grande de logo que ocupa a tela toda hoje.

**Protótipo visual aprovado** (canvas separado, não é código do app):
https://claude.ai/artifact/QHCGEnRzyL6cR2UNRfnyfK — aprovado pelo usuário ("ficou legal") em
16/10/2026.

**Achado ao investigar o código antes de planejar — isso é só frontend, sem endpoint novo.** O state
`appointments` já existe no componente raiz (`App.jsx:302`), já é buscado via `listAppointments()` no
login e depois de ações (linhas 378-379, 460-461), e a lógica de separar "próximo" (upcoming) de
"histórico" **já existe**, duplicada em duas telas diferentes hoje:
- `meus-agendamentos` (linha ~579): `status === 'needs_reschedule' || (status === 'scheduled' &&
  startsAt >= now)`, ordenado crescente — isso é o "próximo agendamento" da nova Início.
- `meus-historicos` (linha ~644): o inverso desse filtro, ordenado decrescente — isso é o "histórico"
  da nova Início.

A Sprint 16 não cria filtro novo, só reaproveita esses dois já existentes dentro da tela Início
reescrita, em vez de deixá-los só nas telas antigas.

**Decisão de escopo:** não é removido nada — `meus-agendamentos`/`meus-historicos` continuam
existindo como estão (telas completas, com cancelar/remarcar), alcançáveis pelo menu lateral. A
Início passa a mostrar só uma prévia (próximo + histórico recente) — "Ver tudo" no histórico leva pra
`meus-agendamentos`/`meus-historicos` de verdade, não duplica a funcionalidade completa.

**Arquivos — Frontend (`apps/cliente-app/src/App.jsx`):**

| Trecho | Mudança |
|---|---|
| Bloco `screen === "home"` (~linha 486-515) | Reescrito: header compacto, card de próximo agendamento, botão secundário "Agendar Horário", lista de histórico (prévia) |
| Novo: componente `Drawer` ou bloco inline | Menu lateral novo — não existe hoje nenhum componente de drawer no app; nasce nessa sprint |
| Novo: state `menuOpen` | Controla abrir/fechar o drawer, local à tela Início (ou ao componente raiz, se o menu precisar abrir de outras telas também — decidir na implementação) |
| Filtro "próximo"/"histórico" | Reaproveitado de `meus-agendamentos`/`meus-historicos` (mesma lógica, sem duplicar regra nova) |

Sem mudança de backend, sem endpoint novo, sem migration — toda a informação já é buscada hoje.

**Plano de implementação, em fases (ordem de execução):**

1. **Drawer (menu lateral)** — componente novo, com os 5 itens de navegação + Sair, abre/fecha por
   state, sobre a tela Início primeiro (não precisa existir nas outras telas ainda nessa fase).
2. **Reescrita da tela Início** — header compacto, card de próximo agendamento (reaproveitando o
   filtro de `meus-agendamentos`), botão secundário de agendar, lista de histórico (prévia,
   reaproveitando o filtro de `meus-historicos`, com link "Ver tudo" pra tela completa).
3. **Verificação manual** — smoke test local nos 3 cenários: cliente sem nenhum agendamento ainda,
   cliente com só agendamento futuro, cliente com futuro + histórico. Esse app não tem suíte e2e
   própria hoje (só o backend tem, seção 7 do `CLAUDE.md`) — verificação é manual no navegador.

**Bugs reais achados e corrigidos durante/depois da implementação (16/10/2026):**
- `confirmSlot()` (criar/remarcar agendamento) nunca atualizava o state `appointments` — só
  `handleCancel` fazia isso. Não aparecia antes porque a Início antiga não mostrava nada de
  agendamento; com o próximo agendamento ao vivo, a lacuna ficou visível (agendava e a Início
  continuava mostrando o estado de antes). Corrigido: mesmo padrão de `handleCancel`, busca
  `listAppointments()` de novo depois de salvar.
- `appointments` só carregava num `useEffect` preso a `screen === "meus-agendamentos"` — nunca
  rodava no login/reload. A Início sempre mostrava "nenhum agendamento futuro" mesmo tendo dado real,
  até o usuário visitar "Meus Agendamentos" pelo menos uma vez. Corrigido: movido pro mesmo efeito de
  `services`/`professionals` (roda assim que há sessão, reutilizado em várias telas).
- Lacuna de produto (não bug de código): o card "Próximo agendamento" mostra só 1 (o mais próximo) e
  o Histórico só mostra concluído/cancelado — um 2º agendamento futuro simultâneo não tinha onde
  aparecer na Início. Resolvido com o botão "Ver tudo" (reaproveitado do rodapé do Histórico, estilo
  outline dourado igual os outros botões da tela, pequeno e alinhado à direita) logo abaixo do card,
  levando pra Meus Agendamentos — não lista todos os futuros na própria Início, de propósito, pra não
  reabrir o escopo da sprint.

**Em aberto, respondida pela Sprint 17 abaixo:** o menu lateral deveria aparecer só na tela Início, ou
em todas as telas do app? Usuário pediu expandir (16/10/2026) — ver Sprint 17.

### ✅ Sprint 17 — [App Cliente] Menu lateral em todas as telas do app — concluído (16/10/2026)

**Motivação:** a Sprint 16 deixou o drawer só na tela Início. Testando o app de verdade, uma vez que o
usuário sai da Início (ex: entra em "Nossos Profissionais" ou "Meus Agendamentos"), só dá pra voltar
passo a passo pela seta "←" de cada tela — não tem atalho direto pra pular pra outra seção sem passar
pela Início de novo. Pedido do usuário (16/10/2026): levar o menu lateral pro resto do app.

**Decisão de escopo, confirmada pelo usuário (16/10/2026): todas as telas do app, sem exceção.**
- **Entram:** as 4 telas reais do MVP (Horários de Funcionamento, Nossos Profissionais, Meus
  Agendamentos, Meus Históricos), as 3 do fluxo de agendamento (Escolha o Serviço, Escolha o
  Profissional, Escolha o Horário), as 4 telas mockadas fora do MVP (Loja, Assinar Plano, Confirmar
  Assinatura, Meu Plano — seção 4 do `CLAUDE.md`; o menu entra nelas também, mas elas continuam fora
  de qualquer navegação real, sem link alcançável no app) e a tela de confirmação de agendamento
  ("Agendado!"/"Remarcado!").
- **Não entram, por não ter como entrar — não é escolha de escopo, é restrição técnica:** `login` e
  `register` (`LoginScreen`/`RegisterScreen`). Essas telas rodam **antes** de existir sessão — não tem
  `user` nem `tenant` autenticado ainda, e o Drawer mostra "Sair" e itens que pressupõem estar logado.
  Não faz sentido técnico mostrar esse menu numa tela de login.

**Achado técnico que muda como vai ser implementado — centralizar em vez de duplicar.** Hoje o
`<Drawer>` só é renderizado dentro do bloco `screen === "home"`. Com a decisão de "todas as telas",
copiar isso em cada uma (11 telas além da Início) duplicaria a mesma renderização 11 vezes. Melhor:
mover o `<Drawer>` pra dentro do próprio componente `Phone` — que já embrulha **toda** tela do app
(inclusive `login`/`register`, que não vão usar o drawer, mas passam pelo mesmo componente), e que já
ganhou `position: relative` na Sprint 16 exatamente como âncora pro drawer. `Phone` passa a aceitar os
mesmos props que o `Drawer` precisa (`tenant`, `user`, `menuOpen`, `onCloseMenu`, `onNavigate`,
`onLogout`) e renderiza o `Drawer` internamente, uma vez só, só quando esses props existem (as telas
de login/register não os passam, então não renderizam o drawer — nenhum `if` extra precisa existir
pra isso). Cada tela que quiser o hambúrguer só precisa passar esses props pro `<Phone>` e adicionar o
botão no próprio header — sem duplicar a lógica do drawer em si.

`BackHeader` (componente compartilhado, usado em 11 das 12 telas que recebem o menu — todas menos a
Início, que já tem header próprio desde a Sprint 16) ganha um prop opcional novo, `onMenu` — quando
presente, mostra o ícone de hambúrguer ao lado do título (`← Título     ☰`).

A tela `confirmacao` ("Agendado!"/"Remarcado!") é a única exceção estrutural: hoje não usa
`BackHeader` nenhum (só o botão "Voltar ao Início", sem seta de voltar nem título com header) — vai
precisar de um hambúrguer isolado (sem o resto do `BackHeader`), não só passar `onMenu`.

**Arquivos — Frontend (`apps/cliente-app/src/App.jsx`, único arquivo, como sempre nesse app):**

| Trecho | Mudança |
|---|---|
| `Phone` (componente) | Ganha props novos (`tenant`, `user`, `menuOpen`, `onCloseMenu`, `onNavigate`, `onLogout`) e passa a renderizar `<Drawer>` internamente, uma vez, quando esses props existem |
| `BackHeader` (componente) | Ganha prop opcional `onMenu` — ícone de hambúrguer ao lado do título quando presente |
| Bloco `screen === "home"` | Remove o `<Drawer>` próprio (agora duplicado) — passa os mesmos props pro `<Phone>` em vez disso |
| Blocos `horarios`, `profissionais`, `meus-agendamentos`, `meus-historicos`, `loja`, `planos`, `confirmar-plano`, `meu-plano`, `servico`, `profissional`, `horario` (11 telas) | `<BackHeader>` ganha `onMenu={() => setMenuOpen(true)}`; `<Phone>` ganha os props do drawer |
| Bloco `confirmacao` | Ganha um botão de hambúrguer isolado (sem `BackHeader`, estrutura própria); `<Phone>` ganha os props do drawer |

Sem mudança de backend, sem endpoint novo — mesma base de dado que a Sprint 16 já usa.

**Plano de implementação, em fases (ordem de execução):**

1. **`Phone` + `Drawer` centralizados** — move a renderização do drawer pra dentro do `Phone`, sem
   duplicar; ainda sem nenhum botão de hambúrguer novo nessa fase, só a infraestrutura movida (a
   Início continua funcionando igual, agora passando os props pro `Phone` em vez de renderizar o
   `Drawer` ela mesma).
2. **`BackHeader` ganha o hambúrguer opcional** (`onMenu`), sem conectar em nenhuma tela ainda.
3. **Conecta nas 4 telas reais do MVP** — Horários de Funcionamento, Nossos Profissionais, Meus
   Agendamentos, Meus Históricos.
4. **Conecta nas 3 telas do fluxo de agendamento** — Escolha o Serviço, Escolha o Profissional,
   Escolha o Horário.
5. **Conecta nas 4 telas fora do MVP** — Loja, Assinar Plano, Confirmar Assinatura, Meu Plano (mesmo
   não sendo alcançáveis por navegação real hoje, ficam consistentes com o resto do app).
6. **Tela `confirmacao`** — hambúrguer isolado, já que não usa `BackHeader`.
7. **Verificação manual** — smoke test em todas as 12 telas atualizadas, celular e desktop (mesma
   preocupação de sempre: `Phone` tem duas variantes de renderização).

**Achado durante a implementação:** existe uma 13ª tela que o plano não tinha nomeado —
`plano-confirmado` ("Assinatura ativa!"), parte da mesma família de "Confirmar Assinatura"/"Meu
Plano" (fora do MVP), sem `BackHeader` nenhum, igual a `confirmacao`. Entrou também, pelo mesmo
critério de "todas as telas".

**Refatoração pequena, dentro do escopo:** o ícone de hambúrguer (3 traços) estava prestes a ficar
triplicado (header próprio da Início, dentro de `BackHeader`, e agora também em `confirmacao`/
`plano-confirmado`, que não usam `BackHeader`) — extraído pra um componente `HamburgerButton`
compartilhado, usado nos três lugares.

**Resultado final:** 13 telas com o menu lateral (as 12 planejadas + a achada no caminho). Só ficam
de fora `LoginScreen`, `RegisterScreen` e a tela de "Carregando.../erro de tenant" (antes de existir
sessão) — confirmado por varredura completa de todo `<Phone>` no arquivo, nenhuma tela real ficou
pra trás.

**Ajuste pedido pelo usuário depois de ver no ar (16/10/2026):** hambúrguer movido pra esquerda em
`BackHeader` (era à direita do título; agora segue o mesmo padrão da Início, à esquerda) e a seta "←"
de voltar **removida de todo lugar** — a navegação passa a ser só pelo menu lateral. `BackHeader`
perdeu o prop `onBack` (não é mais usado em lugar nenhum). Efeito colateral avisado ao usuário e
aceito por ele, a validar: em 3 telas a seta não voltava pra Início, voltava pra um passo específico
de um fluxo ("Escolha o Profissional" → "Escolha o Serviço"; "Horário" ao remarcar → "Meus
Agendamentos"; "Meus Históricos"/"Confirmar Assinatura" → suas telas-mãe) — sem a seta, essas telas só
saem pelos 5 destinos fixos do `Drawer`, não pro "passo anterior exato" (na prática dá no mesmo na
maioria dos casos, já que "Agendar Horário" do menu já recomeça do zero em "Escolha o Serviço").

**Resolvido (16/10/2026):** avatar da Início virou clicável na primeira versão (commit `76366d2`),
abrindo o mesmo `Drawer` do hambúrguer — usuário reportou "não aconteceu nada ao clicar" em homolog;
investigação server-side (deploy atual, bundle batendo com o commit) não achou causa, suspeita era
cache do navegador. **Causa real, achada na validação seguinte:** não era cache nem bug — era
comportamento errado por decisão de design. Clicar no avatar abrir o menu lateral (que por sua vez
tem "Sair" dentro) é indireto; o usuário esperava que o avatar fosse um atalho **direto** de logout,
padrão mais comum pra esse tipo de ícone. Corrigido: clique no avatar agora chama `handleLogout`
direto, sem abrir o `Drawer`.

### ✅ Sprint 18 — [App Cliente] Aviso de reagendamento necessário na tela Início — concluído (22/10/2026)

**Motivação:** usuário relatou que, quando um profissional é inativado (seção 4 do `CLAUDE.md`,
`needs_reschedule` em lote), nada acontece pro cliente do lado do app — "no app do cliente não
acontece nada". Investigação: não era bem verdade — a tela **Meus Agendamentos** já tinha o aviso
("Esse horário não está mais disponível — cancele e agende novamente", card laranja, só permite
Cancelar). O problema real é que a tela **Início**, a primeira que o cliente vê ao entrar, mostrava o
"Próximo agendamento" sempre com o card dourado padrão, mesmo quando esse agendamento estava
`needs_reschedule` — nenhum aviso, nenhuma cor diferente, como se estivesse tudo normal. O cliente só
via o aviso de verdade se navegasse até Meus Agendamentos por conta própria.

**Decisão de escopo, confirmada pelo usuário:** só o aviso visual imediato na Início, reaproveitando o
padrão que já existe (mesma cor laranja `#F5A623`, mesma frase). Notificação push/e-mail de verdade
(avisar o cliente mesmo com o app fechado) ficou de fora — exigiria infraestrutura que o projeto não
tem hoje (service worker + push, ou serviço de e-mail), registrada como pendência separada pra
planejar depois, não como parte dessa sprint.

**Arquivo — Frontend (`apps/cliente-app/src/App.jsx`, bloco `screen === "home"`, card "Próximo
agendamento"):**
- `needsReschedule = proximo.status === "needs_reschedule"` calculado antes do card.
- `accent` passa a ser `#F5A623` (needs_reschedule) ou `T.gold` (normal) — usado no fundo (gradiente),
  borda, cor do preço e divisor de data/hora, no lugar do `T.gold` fixo de antes.
- Mesma frase de aviso de Meus Agendamentos adicionada dentro do card quando `needsReschedule`.
- Nenhuma mudança de clique/ação — o botão "Ver tudo" já levava pra Meus Agendamentos, onde Cancelar
  já funciona desde antes; essa sprint é só sobre visibilidade imediata, não sobre criar ação nova.

Sem mudança de backend — mesmo dado (`appointments`, já incluindo `needs_reschedule`) que a tela já
carregava antes, só não tratava visualmente nesse card específico.

### ✅ Sprint 19 — [Todos os apps] Aviso de sessão expirada, nos 3 frontends — concluído (22/10/2026)

**Motivação:** usuário reportou que a tela "Escolha o Profissional" (cliente-app) mostrou "Nenhum
profissional disponível para esse serviço" pra um serviço que dois profissionais ativos realizam —
causa real era a sessão ter caído no meio do uso, não falta de profissional. Achado na investigação:
em `apiFetch` (os 3 apps têm a mesma função, cada um no seu `src/api/client.js`), quando uma
requisição autenticada volta `401` mesmo depois da tentativa de refresh automático via cookie, o erro
só é lançado genérico — cada tela que chama `apiFetch` tem seu próprio `.catch()` (ex:
`.catch(() => setServiceProfessionals([]))`), que trata esse 401 exatamente igual a "a lista veio
vazia". O usuário nunca via um aviso de verdade dizendo que precisava logar de novo — via uma tela
enganosa, como se o dado fosse genuinamente inexistente.

**Decisão de escopo:** corrigir nos 3 apps (`cliente-app`, `painel-barbearia`, `admin-desenvolvain`) —
todos têm a cópia duplicada do mesmo `apiFetch`/fluxo de refresh, então o mesmo problema existia nos
3, não só onde foi reportado.

**O que mudou, igual nos 3 apps** (`src/api/client.js` + `src/App.jsx` de cada um):
- `apiFetch` agora guarda se havia um token **antes** da chamada (`hadToken`). Se a resposta final
  ainda for `401` depois da tentativa de refresh **e** havia token, é tratado como sessão expirada de
  verdade (não confundir com 401 de login/cadastro com credencial errada, que nunca tem token) — nesse
  caso, limpa o token e chama um handler central (`onSessionExpired`, registrado via novo
  `setSessionExpiredHandler()`).
- `App.jsx` de cada app registra esse handler uma vez (`useEffect` no componente raiz): ao disparar,
  limpa o usuário, define uma mensagem ("Sua sessão expirou. Faça login novamente.") e manda pra tela
  de login.
- `LoginScreen` de cada app ganhou um prop novo (`initialNotice`), que semeia o `error` local já
  existente — reaproveita o mesmo `ErrorBox`/banner de erro que a tela já tinha, sem criar componente
  novo.
- A mensagem é limpa em login bem-sucedido e em logout explícito (`handleLogin`/`handleLogout`), pra
  não aparecer fora de contexto depois.

Sem mudança de backend. Sem mudança de endpoint. Cada tela individual continua com seu
`.catch(() => setX([]))` de sempre — isso continua certo pra erros genuínos (ex: rede caiu numa
chamada pontual); a diferença é que agora uma sessão expirada nunca mais passa por esse caminho
silencioso, é interceptada antes, no nível do `apiFetch`.

## 7. Testes

Todo endpoint novo tem e2e cobrindo RBAC (403 pra não-super_admin) + a lógica específica (cálculo de
líquido do repasse, upsert de assinatura, validação de hex, geração de evento de atividade, etc.) —
ver `apps/api/test/admin/`. Suíte completa: 121/123 rodando com `--runInBand` (a suíte cresce demais
em paralelo pro pool de conexões do Postgres local — cada `beforeAll` abre um Nest app + pool próprio,
então rodar tudo em paralelo derruba testes por timeout de transação sem relação com o código). As 2
falhas restantes são pré-existentes e não relacionadas a este trabalho: `connection-pool-leak.e2e-spec.ts`
(flakiness pré-existente do ambiente local, confirmada via `git stash`) e `admin-plans.e2e-spec.ts`
(assume banco limpo, mas o banco de dev local já tem os planos reais `pro`/`enterprise` cadastrados
pelo uso manual do painel — colisão de dado de ambiente, não bug).

## 8. Riscos ainda vigentes

- **Repasses:** cálculo automático de receita/taxa continua fora de escopo até existir regra de
  negócio validada — o que existe hoje é só registro manual com a conta feita.
- **Repasses, achado mais fundo (2026-10-16):** a própria existência da tela não bate com o modelo
  de negócio documentado na seção 1 do `CLAUDE.md` — B2B2C onde a barbearia é a "cliente pagante"
  da incubadora via mensalidade, sem nenhum fluxo de pagamento do cliente final passando pela
  plataforma. "Repasses" pressupõe um modelo de marketplace/intermediador de pagamento (incubadora
  processa o pagamento do corte, fica com taxa%, devolve líquido pra barbearia) — isso nunca existiu
  em nenhuma outra parte do sistema; agendamento é só agenda, sem cobrança embutida. Provável herança
  do protótipo visual original (que tinha telas de loja/comissão/financeiro avançado), implementada
  no Sprint 6 sem confrontar contra o modelo de negócio real na hora. **Decisão do usuário: deixar
  como está por enquanto**, só registrado — não remover nem corrigir até decisão futura.
- **Impersonação (Sprint 12):** ainda não implementada — maior risco de segurança do que falta
  construir, não pular a revisão dedicada quando chegar a vez.
- **Financeiro cross-tenant (`GET /v1/admin/payments`):** decidido remover na Sprint 8 (não manter) —
  ver seção 6, Sprint 8, lista de arquivos afetados pela remoção (controller, service, teste,
  benchmark, client.js).
- **Upload de logo:** só client-side por enquanto (preview local), sem persistência — se isso virar
  prioridade, precisa de uma decisão de infra (Supabase Storage, presigned URL) antes de implementar,
  conforme seção 6.1.6 do `CLAUDE.md`.

---

## 9. Ambiente local

Banco de dev resetado em 18/08/2026 — só resta o super_admin real (`admin@desenvolvain.com.br`);
tenants, planos e configurações voltaram ao zero/padrão. Qualquer teste manual ou automatizado que
rodar localmente a partir daqui deve recriar seus próprios dados (planos, tenants) antes de usar o
painel — não há mais dado de exemplo/seed pré-carregado.

---

*Atualizado em 16/10/2026 — Painel Master DesenvolvaIN.*
