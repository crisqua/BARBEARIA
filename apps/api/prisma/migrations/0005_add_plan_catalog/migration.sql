-- Catálogo de planos da plataforma (Sprint 4 do painel master DesenvolvaIN,
-- ver admin-desenvolvain.md). Sem tenant_id — é dado da incubadora, não de
-- tenant, mesmo raciocínio de `tenants` (seção 6.4 do CLAUDE.md). Por não
-- ter tenant_id, o gate de RLS (scripts/check-rls.sql) nem avalia esta
-- tabela — não precisa de exceção documentada nova.
--
-- `code` é fixo por decisão de negócio (trial|pro|enterprise) e único;
-- nome/preço/limite/módulos ficam editáveis via /v1/admin/plans.
CREATE TABLE "plans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(20) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "price_cents" INTEGER,
  "limit_label" VARCHAR(255),
  "modules" JSONB NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "plans_code_key" ON "plans" ("code");
