# Barberaria — Contexto do Projeto para Claude Code

Este arquivo deve ficar salvo como `CLAUDE.md` na raiz do repositório. O Claude Code lê esse arquivo automaticamente e usa como contexto persistente em todas as sessões — não precisa colar isso a cada prompt.

**Revisão:** este documento incorpora os ajustes arquiteturais validados em `Barberaria_Analise_Ajustes_Arquiteturais.md` (revisão de multi-tenancy, integridade referencial e RLS + connection pooling). As decisões dessa revisão já estão embutidas nas seções abaixo — não é mais um documento separado.

**Revisão (2026-08-08):** decisão de infraestrutura trocada de Terraform + AWS para **Supabase (Postgres gerenciado) + Render (backend) + Vercel (frontend)** — infra mais leve para a fase atual do MVP, sem provisionar conta AWS. Todo o resto do documento (schema, RLS, FKs compostas, mecanismo de tenant context da seção 6.3) permanece válido sem alteração — Supabase é Postgres puro, então nada no modelo de dados muda. Seção 2 e seção 9 já refletem essa troca.

**Revisão (2026-08-10):** Sprints 1–6 concluídas (backend + dois frontends conectados, CI verde). Sprint 7 (piloto) em andamento em ambiente local — surgiu um ajuste real de escopo/schema e um bug de fuso corrigido, já implementados e refletidos nas seções 4 e 5.1:
- Campo `active` em `users`, com fluxo de ativar/inativar profissional (ver seção 4).
- Status `needs_reschedule` em `appointments`, gerado automaticamente quando um profissional com agendamentos futuros é inativado.
- Bug real corrigido (não é decisão nova, é fix): o corte de "horário já passado" comparava `Date.now()` (UTC real do processo) contra `starts_at` (tratado como hora local da barbearia sem conversão, seção 4 "decisões adiadas"). Em fuso diferente de UTC isso escondia/liberava horários errados. Corrigido com um helper `nowInBarbershopTime()` que usa timezone fixo (`America/Sao_Paulo`) via `Intl`, tanto no backend (`common/time.util.ts`) quanto duplicado nos dois frontends — nenhuma mudança de escopo, só a comparação ficou consistente com o resto do sistema.

**Revisão (2026-08-18):** terceira entidade do sistema (seção 1) ganhou implementação própria — o **Painel Master da Incubadora**, `apps/admin-desenvolvain`. Nasceu como protótipo visual aprovado (mock, mesmo espírito de `admin-barbearia.md`), depois movido para dentro deste monorepo (antes era repositório separado). Plano de build completo em 10 sprints, com decisões de escopo explícitas (billing/planos/repasses ainda não implementados — exigem confirmação antes de cada sprint), em `admin-desenvolvain.md`. Sprint 1 concluído: login de super_admin + CRUD de tenants (`/v1/admin/tenants`, já existente no backend) conectado de verdade, substituindo o array mockado do protótipo. Consome a API em `apps/api` do mesmo jeito que `painel-barbearia` (JWT + refresh cookie httpOnly), porta de dev `5175` — `CORS_ORIGIN` já inclui essa origem.

**Revisão (2026-08-18, continuação):** Sprints 2–6 do Painel Master concluídos, com uma expansão real de escopo confirmada explicitamente pelo usuário a cada etapa (billing da incubadora — seção 4 já marcava isso como "fora do MVP", decisão consciente de ampliar). Modelos novos: `Plan` (catálogo trial/pro/enterprise), `Subscription`, `Payment`, `Payout`, `PlatformSettings` (migrations `0005`–`0008`). Decisão de RLS revista durante a execução: `Subscription`/`Payment`/`Payout` **não** ficaram isentas de RLS como o plano original previa — são dado do tenant (mesma categoria de `services`/`appointments`), RLS normal, leitura cross-tenant do Super Admin soma por tenant via `TenantContextService` (mesmo mecanismo desde sempre usado pra `users`/`appointments`, que também têm RLS forçado). Detalhe técnico achado no caminho: a role de runtime (`barberaria_app`) é `NOBYPASSRLS` de propósito, então leitura cross-tenant direta numa tabela com RLS forçado falha ou retorna vazio — nunca dá pra ler direto, só somando por tenant. Nenhum bypass de RLS novo foi introduzido em nenhum momento. Detalhes completos e status sprint-a-sprint em `admin-desenvolvain.md`.

**Revisão (2026-08-18, continuação 2):** duas features extras no Painel Master, fora da sequência de sprints. (1) **Atividade recente** real no Dashboard: novo modelo `PlatformActivity` (migration `0009`, RLS normal, mesma categoria de `Subscription`/`Payment`/`Payout`), eventos gravados na mesma transação da ação que os originou (criação/suspensão/reativação de tenant, troca de plano, pagamento e repasse registrados/pagos) — substituiu o card de exemplo mockado. (2) **Validação obrigatória no Onboarding**: o wizard de Nova Barbearia deixava avançar de passo sem preencher nada; agora todo campo do passo 1 (nome, slug, admin, e-mail no padrão `nome@dominio.tld`, senha, plano) e do passo 2 (cores em hex válido) é obrigatório, e a navegação (botão Próximo e clique nas abas do step bar) só avança se o passo anterior estiver válido. Ambas com testes e2e cobrindo o caminho novo; detalhes técnicos completos em `admin-desenvolvain.md`. Banco de dev local foi resetado nesse meio-tempo (só resta o super_admin real) — dado efêmero de ambiente, não afeta arquitetura.

**Revisão (2026-08-22):** Sprint 7 (piloto) segue em andamento — ajustes reais decorrentes de testes manuais no ambiente local, tenant `homologador`. Implementado:
1. `GET /services/:id/professionals` não validava se o serviço estava ativo (deixava o cliente escolher profissional pra um serviço já desativado) — agora usa o mesmo filtro `active: true` de `availability.service.ts`/`appointments.service.ts`.
2. Desativar um **serviço** agora dispara `needs_reschedule` em lote nos agendamentos futuros, igual já acontecia pra profissional (seção 4).
3. **Novo:** reativar um serviço ou profissional agora reverte automaticamente pra `scheduled` os agendamentos futuros que ficaram `needs_reschedule` por causa dele (`common/revert-needs-reschedule.util.ts`) — linha a linha, não em lote, pulando qualquer registro cujo horário tenha sido ocupado por outro agendamento nesse meio-tempo (respeita o índice anti-double-booking, seção 5.3, em vez de tentar sobrescrevê-lo).
4. Rótulos de `needs_reschedule` generalizados nos dois frontends (antes fixos em "profissional inativo") — a causa agora também pode ser um serviço, e o app não deve afirmar uma causa que não pode verificar.
5. Upload real de logo — `POST /v1/tenants/me/logo`, **MVP local em disco** (`apps/api/uploads/`, servido estático por `main.ts`). Continua pendente antes de produção: trocar por Supabase Storage/presigned URL (seção 6.1.6) — Render não tem disco persistente entre deploys.
6. Filtros de cliente/serviço/profissional adicionados à tela Agenda do painel-barbearia (já existiam só no Dashboard).
7. Admin agora cancela, remarca e **conclui** agendamentos pelo próprio painel (antes só dava pra ver, não pra agir). Novo `PATCH /appointments/:id/complete` — regras completas na seção 4 acima.

**Pendente, registrado de propósito pra não esquecer:** subdomínio automático por tenant (`slug.barberaria.app`, seção 4) continua **não implementado**. Cada frontend aponta pra um tenant fixo via `VITE_TENANT_SLUG` no `.env`, resolvido em build time; o campo `tenantSlug` no login segue "interino" (comentário já existente em `login.dto.ts`). Bloqueado numa decisão de infra fora do escopo de código: domínio real + DNS wildcard (`*.barberaria.app`) + configuração de wildcard domain na Vercel — não dá pra testar localmente do jeito real, só simulável via hosts manuais. Retomar quando essa decisão de infra existir. A parte de código (frontend resolvendo o slug por `window.location.hostname` em vez do env var) é pequena e pode ser adiantada antes disso, se fizer sentido.

---

## 1. O que é o projeto

Sistema **White Label Multitenant** para barbearias ("Barberaria"), modelo B2B2C:
- **Incubadora** = camada master admin (gerencia todos os tenants/barbearias)
- **Barbearia** = tenant (cliente pagante, tem seu próprio branding)
- **Cliente final** = usuário do app da barbearia (agenda cortes)

Estamos construindo o **MVP**, não o produto completo. Escopo detalhado na seção 4.

---

## 2. Stack técnica (decisões fechadas — não sugerir alternativas)

- **Backend:** NestJS + TypeScript
- **ORM:** Prisma (versão mínima 4.7+, necessária para transação interativa — ver seção 6.3)
- **Banco:** PostgreSQL (com Row-Level Security nativo — obrigatório, não opcional)
- **Frontend:** React + Vite
- **Cache:** Redis (config de tenant: cor/logo/módulos) — provedor gerenciado a definir quando o módulo `tenants`/cache entrar em escopo (Sprint 3), compatível com Render/Vercel (ex: Upstash)
- **Fila:** equivalente leve a SQS, só para o que for assíncrono (e-mail de confirmação) — provedor a definir quando o módulo `appointments` precisar disso (Sprint 5); não é bloqueante para o MVP inicial
- **Infra:** **Supabase** (Postgres gerenciado, com pooler compatível com PgBouncer em modo transaction) + **Render** (hospedagem do backend NestJS) + **Vercel** (hospedagem dos frontends React/Vite). Sem Terraform/AWS por enquanto — decisão consciente para reduzir complexidade operacional nesta fase do MVP.
- **Arquitetura de software:** Monólito modular, stateless, **não microsserviços, não GraphQL**
- **Connection pooling:** o pooler do Supabase (Supavisor, compatível com PgBouncer) deve ser usado em **modo transaction pooling obrigatório** (session pooling é incompatível com a estratégia de tenant context da seção 6.3). Migrations (`prisma migrate`) usam a conexão direta (`DIRECT_URL`, não-pooled), não o pooler.

Não proponha microsserviços, GraphQL, troca de banco, ou Terraform/AWS — essas decisões já foram avaliadas e fechadas.

---

## 3. Protótipos existentes (ponto de partida do frontend)

Já existem dois protótipos funcionais em React, com dados mockados, que devem ser **reaproveitados e conectados a uma API real**, não recriados do zero:

- `apps/cliente-app/src/App.jsx` — app do cliente final (agendamento, perfil de profissionais, histórico)
- `apps/painel-barbearia/src/App.jsx` — painel administrativo da barbearia

**Importante:** esses arquivos têm mais telas do que o MVP usa (planos/assinatura, loja, dashboard financeiro, NPS). Essas telas extras **não devem ser apagadas**, apenas ocultadas/desativadas por enquanto (ex: remover o card de navegação que leva até elas, ou marcar como "em breve"). Ver mapeamento completo na seção 4.

Antes de mexer no código desses arquivos, leia o conteúdo completo dos dois para entender a estrutura de estado (`useState`), o objeto de tokens de cor (`T`) e como a navegação entre telas funciona (`screen` como state machine simples).

---

## 4. Escopo do MVP

### Entra no MVP
- Login/cadastro: Super Admin, Admin Barbearia, Barbeiro, Cliente
- CRUD de profissionais e serviços
- Configuração de horário de funcionamento
- Agendamento completo (serviço → profissional → horário → confirmação)
- Cancelamento/reagendamento
- Histórico de agendamentos do cliente
- Personalização visual: cor primária/secundária + logo (via `tenants` config)
- Subdomínio automático por tenant (`slug.barberaria.app`) — **ainda não implementado** (ver revisão 2026-08-22 no topo do documento); cada frontend hoje aponta pra um tenant fixo via `VITE_TENANT_SLUG`, bloqueado numa decisão de infra (domínio + DNS wildcard + Vercel).
- Painel admin básico: visão de agendamentos do dia/semana
- Ativar/inativar profissional (`users.active`) e ativar/inativar serviço (`services.active`): admin desativa via `PATCH /v1/professionals/:id` ou `PATCH /v1/services/:id`. Recurso inativo some do fluxo de agendamento do cliente (lookup serviço→profissional e navegação direta) e o backend rejeita criar agendamento ou consultar disponibilidade pra ele, mesmo via API direta — inclui `GET /services/:id/professionals`, que também passou a checar `active`. Ao inativar, todo agendamento futuro com status `scheduled` ligado a esse profissional/serviço muda em lote para `needs_reschedule` (resposta do PATCH inclui `affectedAppointmentsCount` para o painel avisar o admin). Agendamento `needs_reschedule` só pode ser cancelado (não remarcado — remarcar manteria o mesmo profissional/serviço inativo), forçando um novo agendamento. **Reativar reverte automaticamente**: agendamentos futuros que ficaram `needs_reschedule` por causa daquele recurso voltam pra `scheduled` (resposta inclui `revertedAppointmentsCount`) — linha a linha, pulando qualquer horário que tenha sido ocupado por outro agendamento nesse meio-tempo (não força conflito contra o índice anti-double-booking, seção 5.3).
- Admin gerencia agendamentos pelo painel (`painel-barbearia`), não só visualiza:
  - **Cancelar** (`PATCH /appointments/:id/cancel`): admin ou cliente, a partir de `scheduled` ou `needs_reschedule`.
  - **Remarcar** (`PATCH /appointments/:id/reschedule`): admin ou cliente, só a partir de `scheduled` (`needs_reschedule` não remarca, só cancela — regra acima).
  - **Concluir** (`PATCH /appointments/:id/complete`): **só admin** (nem cliente, nem barbeiro — `painel-barbearia` é admin-only hoje, não existe UI pra barbeiro agir sobre a própria agenda). Só a partir de `scheduled`; vira `completed`. Sem checagem de horário — decisão consciente de simplicidade pro MVP, o admin decide quando marcar. Ação definitiva: não existe rota pra reverter `completed` de volta.

### Fica fora do MVP (não implementar ainda, mesmo que exista tela no protótipo)
- Assinaturas/planos recorrentes e billing
- Comissionamento
- Dashboard financeiro avançado
- Marketing, promoções, loyalty
- Estoque/produtos (loja)
- Notificações WhatsApp automatizadas
- Domínio customizado próprio
- NPS

Se em algum momento parecer necessário implementar algo dessa segunda lista para o MVP funcionar, **pare e pergunte antes de implementar** — não expanda escopo silenciosamente.

### Decisões conscientemente adiadas (não são esquecimento, são débito técnico documentado)

- **Identidade global de usuário:** hoje `UNIQUE(tenant_id, email)` permite o mesmo e-mail em tenants diferentes, como identidades separadas. Uma evolução futura (`users` + `tenant_users`) permitiria um mesmo cliente logar em várias barbearias com uma identidade única. **Não implementar no MVP** — só revisitar se houver demanda real validada.
- **Sobreposição de horário no anti-double-booking:** o índice atual (seção 5.3) impede apenas `starts_at` idêntico para o mesmo profissional, não sobreposição de intervalo (ex: 14:00–14:45 e 14:30–15:15 não são bloqueados entre si). Solução futura já mapeada (constraint de exclusão com `btree_gist`, seção 5.3). **Não implementar no MVP**, mas o frontend deve gerar a lista de horários disponíveis já considerando a duração do serviço anterior, para minimizar a chance prática de colisão.
- **Timezone por tenant:** o schema não modela fuso horário — `starts_at`/`ends_at` (Timestamptz) e `working_hours.start_time`/`end_time` (Time) são tratados como a hora local da barbearia, sem conversão, sempre lidos/escritos via getters/`Date.UTC` em UTC (nunca o timezone do processo Node). Qualquer comparação com "agora" (ex: bloquear agendamento no passado) deve usar `nowInBarbershopTime()` (`common/time.util.ts` no backend, duplicado nos dois frontends), que fixa o timezone em `America/Sao_Paulo` via `Intl` — comparar direto com `Date.now()`/`new Date()` quebra em qualquer ambiente cujo relógio do processo não seja Brasília (ex: Render roda em UTC). **Não implementar timezone por tenant no MVP** — só revisitar se o mercado deixar de ser só Brasil.

---

## 5. Modelo de dados (schema fechado, usar como base do `schema.prisma`)

Princípio: **Shared Database, Shared Schema** — todas as barbearias usam as mesmas tabelas, diferenciadas por `tenant_id`. Nunca criar tabela ou schema duplicado por cliente.

### 5.1 Tabelas e constraints

```sql
-- ═══════════════════════════════════════════
-- TENANTS (barbearias) — fora do RLS, ver seção 6.4
-- ═══════════════════════════════════════════
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(63) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  primary_color VARCHAR(7) DEFAULT '#C9A84C',
  secondary_color VARCHAR(7) DEFAULT '#0F0F0F',
  logo_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | suspended
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════
-- USERS (todos os papéis)
-- ═══════════════════════════════════════════
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id), -- NULL apenas para Super Admin
  role VARCHAR(20) NOT NULL, -- super_admin | admin | barbeiro | cliente
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true, -- só relevante pra role=barbeiro; ver seção 4
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, email),
  UNIQUE (tenant_id, id), -- necessário para as FKs compostas abaixo

  -- Integridade: só Super Admin pode ter tenant_id NULL
  CONSTRAINT chk_super_admin_no_tenant CHECK (
    (role = 'super_admin' AND tenant_id IS NULL) OR
    (role != 'super_admin' AND tenant_id IS NOT NULL)
  )
);

-- ═══════════════════════════════════════════
-- SERVICES
-- ═══════════════════════════════════════════
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  price_cents INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, id) -- necessário para as FKs compostas abaixo
);

-- ═══════════════════════════════════════════
-- PROFESSIONAL_SERVICES
-- FK composta garante que professional_id e service_id
-- pertencem ao MESMO tenant_id da linha — não apenas que existem.
-- ═══════════════════════════════════════════
CREATE TABLE professional_services (
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  professional_id UUID NOT NULL,
  service_id UUID NOT NULL,
  PRIMARY KEY (professional_id, service_id),
  CONSTRAINT fk_prof_tenant FOREIGN KEY (tenant_id, professional_id)
    REFERENCES users (tenant_id, id),
  CONSTRAINT fk_service_tenant FOREIGN KEY (tenant_id, service_id)
    REFERENCES services (tenant_id, id)
);

-- ═══════════════════════════════════════════
-- WORKING HOURS
-- ═══════════════════════════════════════════
CREATE TABLE working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  professional_id UUID NOT NULL,
  weekday SMALLINT NOT NULL, -- 0=domingo ... 6=sábado
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CONSTRAINT fk_working_hours_prof_tenant FOREIGN KEY (tenant_id, professional_id)
    REFERENCES users (tenant_id, id)
);

-- ═══════════════════════════════════════════
-- APPOINTMENTS (núcleo do MVP)
-- FK composta tripla: client, professional e service
-- precisam pertencer ao mesmo tenant da linha.
-- ═══════════════════════════════════════════
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  service_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled | cancelled | completed | needs_reschedule (ver seção 4)
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_appt_client_tenant FOREIGN KEY (tenant_id, client_id)
    REFERENCES users (tenant_id, id),
  CONSTRAINT fk_appt_prof_tenant FOREIGN KEY (tenant_id, professional_id)
    REFERENCES users (tenant_id, id),
  CONSTRAINT fk_appt_service_tenant FOREIGN KEY (tenant_id, service_id)
    REFERENCES services (tenant_id, id)
);
```

### 5.2 Índices (pensados para performance desde o schema, não depois)

```sql
-- tenant_id sempre como primeira coluna: toda query filtra por tenant primeiro
CREATE INDEX idx_users_tenant ON users (tenant_id, role);
CREATE INDEX idx_services_tenant ON services (tenant_id, active);
CREATE INDEX idx_appointments_tenant_date ON appointments (tenant_id, starts_at);
CREATE INDEX idx_appointments_professional ON appointments (tenant_id, professional_id, starts_at);
CREATE INDEX idx_appointments_client ON appointments (tenant_id, client_id, starts_at);
```

### 5.3 Anti-double-booking

```sql
-- Evita conflito de horário duplo para o mesmo profissional (mesmo starts_at exato)
CREATE UNIQUE INDEX idx_no_double_booking
  ON appointments (tenant_id, professional_id, starts_at)
  WHERE status = 'scheduled';
```

Impede, **no nível do banco**, dois agendamentos concorrentes para o mesmo horário exato do mesmo profissional — mais confiável do que validar isso só na aplicação sob concorrência.

**Limitação conhecida (débito técnico documentado, não implementar no MVP):** este índice não impede *sobreposição* de intervalos com `starts_at` diferentes (ex: 14:00–14:45 e 14:30–15:15). Evolução futura, já desenhada para quando for priorizada:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments ADD CONSTRAINT no_overlap_appointments
  EXCLUDE USING gist (
    tenant_id WITH =,
    professional_id WITH =,
    tsrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'scheduled');
```

### 5.4 Row-Level Security (aplicado em todas as tabelas de negócio)

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON services
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_services FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON professional_services
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON working_hours
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON appointments
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**`tenants` propositalmente não entra nessa policy.** Motivo: o Super Admin precisa enxergar todos os tenants simultaneamente (painel mestre da Incubadora), o que não combina bem com um modelo baseado em uma única `current_setting` por transação. O isolamento de `tenants` é feito por **separação de rotas e RBAC**, não por RLS — ver seção 6.4.

### 5.5 CI/CD gate de RLS

Script de verificação no pipeline: a cada migration nova, o CI roda uma query que lista tabelas com coluna `tenant_id` e confere se `relrowsecurity = true` no catálogo do Postgres. Se uma tabela nova não tiver RLS ativo — **exceto `tenants`, que é exceção documentada e intencional** —, o build quebra. Isso vale desde a primeira sprint do MVP.

---

## 6. Regras de segurança não-negociáveis

Estas regras se aplicam a **todo código gerado neste projeto**, sem exceção:

### 6.1 Regras gerais
1. **`tenant_id` nunca vem de URL, query string ou body da requisição.** Sempre extraído do JWT autenticado, via middleware/interceptor central — nunca lido diretamente em um controller.
2. **JWT de curta duração (15 min) + refresh token httpOnly.** Nunca token de longa duração sem refresh.
3. **RBAC em toda rota**, checando papel (`super_admin`, `admin`, `barbeiro`, `cliente`) via guard — nunca checagem de permissão manual dentro do controller.
4. **Senha sempre com bcrypt/argon2.** Nunca texto plano, nunca hash fraco (MD5/SHA1).
5. **Segredos (DB, JWT secret, credenciais) nunca hardcoded nem em `.env` versionado.** Usar as variáveis de ambiente/secrets do provedor (Render para o backend, Vercel para o frontend, Supabase para credenciais de banco) em produção; `.env.example` sem valores reais pode ir para o repo.
6. **Upload de logo:** presigned URL do **Supabase Storage** (S3-compatible), validação de tipo/tamanho, nunca upload direto passando pelo backend sem validação.
7. **RLS habilitado em toda tabela nova com `tenant_id`** (exceto `tenants`, exceção documentada). Se você criar uma migration com tabela nova, a policy de RLS é parte obrigatória da mesma migration.
8. **Toda associação entre entidades de tenants diferentes deve ser impossível no nível de banco**, via FK composta (ver seção 5.1) — nunca depender só de validação em código para isso.

### 6.2 Fluxo JWT → Tenant → RLS (visão geral)

```
Request → AuthGuard valida JWT → tenant_id extraído do payload
  → TenantContextInterceptor abre transação Prisma
  → set_config('app.current_tenant_id', tenant_id, true) — escopo LOCAL/transação
  → repositórios executam queries usando o client transacional (tx)
  → RLS filtra automaticamente por tenant_id
  → COMMIT (contexto é descartado automaticamente)
```

### 6.3 Prisma + PostgreSQL RLS + Connection Pooling — mecanismo obrigatório

**Este é o ponto de maior risco técnico do projeto e é bloqueante para o Definition of Done da Sprint 1.**

Por quê: `current_setting('app.current_tenant_id')` é uma variável de sessão do Postgres. Como o Prisma (e qualquer client) usa pool de conexões, a mesma conexão física é reaproveitada entre tenants diferentes. Um `SET` simples (escopo de sessão) deixaria a variável "vazando" para a próxima request que reaproveitar aquela conexão — isso anularia a proteção da RLS sem que ninguém percebesse em teste manual (que roda uma request de cada vez).

**Implementação obrigatória:**

1. Toda rota autenticada de tenant (não as rotas `/admin/*` do Super Admin) passa por um `TenantContextInterceptor` (ou Prisma Client Extension) que:
   - Abre uma transação interativa: `prisma.$transaction(async (tx) => { ... })`
   - Primeira instrução dentro da transação: `SELECT set_config('app.current_tenant_id', $1, true)` — **parametrizado (`$1`), nunca concatenação de string**, mesmo o `tenant_id` vindo de um JWT validado (defesa em profundidade contra SQL injection).
   - O terceiro argumento `true` do `set_config` equivale a `SET LOCAL` — escopo de transação, descartado automaticamente no `COMMIT`/`ROLLBACK`.
2. **Toda query de negócio dentro da request usa o client transacional (`tx`), nunca o `prisma` global direto** — usar o cliente errado faz a query escapar do contexto de tenant e do RLS.
3. O pooler do Supabase (Supavisor, compatível com PgBouncer) deve estar em **modo transaction pooling obrigatório** — compatível com `SET LOCAL` por transação. Session pooling é incompatível com esta estratégia e não deve ser usado. Na prática: `DATABASE_URL` (usada pela app em runtime) aponta para a porta do pooler em modo transaction; `DIRECT_URL` (usada só por `prisma migrate`) aponta para a conexão direta do Supabase, já que DDL não é confiável através do pooler.
4. Rotas do Super Admin (`/admin/*`) não passam por esse wrapper — usam acesso direto sem tenant context, já que operam sobre múltiplos tenants.

**Teste obrigatório específico:** simular duas requisições quase simultâneas de tenants diferentes reaproveitando conexões do pool, e provar que não há vazamento de contexto entre elas — mais forte que o teste de isolamento "normal" (ver seção 7).

### 6.4 Autorização na tabela `tenants` (sem RLS)

`tenants` fica fora da policy de RLS (seção 5.4). Autorização feita via separação de rotas e RBAC:

- **`/v1/admin/tenants/*`** — exige `role = super_admin`. Sem tenant context. Acesso irrestrito a todas as linhas de `tenants` (criar, listar, atualizar, desativar).
- **`/v1/tenants/me`** — exige tenant autenticado (`admin` da barbearia). Sempre filtra `WHERE id = <tenant_id do JWT>`. Nunca aceita outro ID via parâmetro.

Implementar como **dois módulos NestJS distintos**, cada um com seu próprio guard — não reaproveitar o mesmo controller para os dois casos de uso, para evitar que um erro de roteamento exponha rota de Super Admin para admin de barbearia.

Regras de acesso:
```
Super Admin  → CREATE / READ / UPDATE / DISABLE qualquer tenant
Admin Barbearia → READ / UPDATE apenas o próprio tenant (branding)
```

---

## 7. Testes obrigatórios (não pular, mesmo no MVP)

1. **Isolamento básico entre tenants:** criar tenant A e B, autenticar como A, tentar ler/escrever dado de B → deve sempre falhar.
2. **IDOR via URL:** `GET /appointments/{id-do-tenant-B}` autenticado como tenant A → `DENIED`/`NOT FOUND`.
3. **Manipulação de body:** enviar `{ "tenant_id": "tenant-B" }` no payload de uma request autenticada como tenant A → `tenant_id` do body deve ser ignorado, nunca usado.
4. **Manipulação de query string:** `GET /appointments?tenant_id=tenant-B` → `tenant_id` da query não deve alterar o contexto autenticado.
5. **Associação cruzada em `professional_services`:** tentar associar profissional do tenant A com serviço do tenant B → deve falhar por violação de FK composta.
6. **Associação cruzada em `appointments`:** tentar criar agendamento com client do tenant A e service do tenant B → deve falhar por violação de FK composta.
7. **Vazamento de contexto sob connection pooling:** disparar requests quase simultâneas de tenants diferentes e provar que não há vazamento de `tenant_id` entre elas (ver seção 6.3).
8. **Concorrência no agendamento:** disparar duas requisições simultâneas para o mesmo profissional/horário exato → apenas uma pode ser aceita (índice anti-double-booking, seção 5.3).
9. **Super Admin não pode virar identidade cross-tenant:** confirmar que rotas `/admin/*` não permitem que um usuário comum acesse dados de outro tenant, e que o Super Admin não aparece como "pertencente" a nenhum tenant específico.

Esses testes rodam no CI e **bloqueiam merge se falharem**.

---

## 8. Regras de performance

1. **Stateless desde o início** — nenhuma sessão em memória no processo da aplicação.
2. **Todo índice composto usado por query multitenant tem `tenant_id` como primeira coluna.**
3. **Cache Redis para config de tenant** (cor, logo, módulos ativos) — não bater no banco a cada request para isso.
4. **Paginação obrigatória em toda listagem** — nunca retornar lista sem limite.
5. **Prevenção de double-booking é responsabilidade do banco** (índice único condicional), a aplicação não deve confiar só em validação em memória.
6. Transações abertas por request (necessárias para o mecanismo da seção 6.3) têm custo de performance aceitável — é o preço de fazer RLS corretamente sob connection pooling. Não otimizar removendo a transação.

---

## 9. Sequenciamento (siga esta ordem, não pule etapas)

| Sprint | Entregável |
|---|---|
| 1 | Infra base (projeto Supabase + serviço Render + CI/CD no GitHub Actions), schema inicial com FKs compostas + RLS + mecanismo `SET LOCAL`/transação (seção 6.3) + testes de isolamento completos (seção 7) |
| 2 | Auth (JWT + refresh) + RBAC + TenantGuard/Interceptor |
| 3 | Módulo `tenants` (rotas separadas admin/tenant, provisionamento + branding) + Redis cache de config |
| 4 | Módulo `services` + `professionals` + `working_hours` (CRUD) |
| 5 | Módulo `appointments` (criação, cancelamento, índice anti-double-booking) + conexão do frontend cliente |
| 6 | Painel admin da barbearia conectado ao backend |
| 7 | Piloto com barbearia real — ajustes |

**A Sprint 1 não é considerada concluída sem o mecanismo da seção 6.3 implementado e testado sob concorrência** — isso é mais crítico que ter RLS "ligado" isoladamente, porque RLS mal integrado com pooling gera falsa sensação de segurança.

---

## 10. Como trabalhar comigo (Claude Code) neste projeto

- Sempre que for criar uma tabela nova, inclua a policy de RLS (ou justifique a exceção, como em `tenants`) e as FKs compostas necessárias na mesma migration — não deixe para depois.
- Sempre que for criar uma rota autenticada de tenant, cheque se ela passa pelo `TenantContextInterceptor` (seção 6.3) e usa o client transacional (`tx`), nunca o `prisma` global.
- Sempre que for criar uma rota, cheque se ela precisa de `@Roles()` e se o `tenant_id` está vindo do JWT, nunca do payload.
- Antes de implementar uma funcionalidade da lista "fora do escopo" (seção 4) ou uma das "decisões conscientemente adiadas", pare e confirme comigo.
- Ao mexer nos protótipos (`App.jsx`), prefira extrair telas em componentes menores conforme for conectando à API, em vez de manter tudo em um arquivo gigante — mas isso é refatoração incremental, não precisa reescrever tudo de uma vez.
- Rode os testes de isolamento (seção 7) antes de considerar uma sprint concluída, especialmente o teste de vazamento sob connection pooling.

---

## Prompt inicial (copie e cole no Claude Code para começar a Sprint 1)

```
Vamos iniciar o projeto Barberaria seguindo o CLAUDE.md deste repositório.

Comece pela Sprint 1:
1. Configure a estrutura do backend NestJS com Prisma, seguindo a stack definida na seção 2.
2. Crie o schema.prisma a partir do modelo de dados da seção 5, incluindo FKs compostas
   (professional_services, appointments), a CHECK constraint do Super Admin, e os índices.
3. Gere a migration inicial já incluindo as policies de RLS da seção 5.4 (exceto tenants,
   conforme seção 6.4) — não deixe RLS como tarefa separada.
4. Implemente o TenantContextInterceptor descrito na seção 6.3: transação Prisma por
   request, set_config parametrizado com escopo LOCAL, uso obrigatório do client
   transacional (tx) em todos os repositórios.
5. Configure o pipeline de CI (GitHub Actions) com um step que verifica, via query no
   catálogo do Postgres, se toda tabela com coluna tenant_id (exceto tenants) tem
   relrowsecurity = true. Quebrar o build se alguma tabela não tiver.
6. Escreva os testes automatizados de isolamento da seção 7, incluindo o teste de
   vazamento de contexto sob connection pooling (item 7) e os testes de associação
   cruzada (itens 5 e 6).

Antes de começar, me mostre o plano de arquivos que você vai criar para eu validar, e só depois implemente.
```
