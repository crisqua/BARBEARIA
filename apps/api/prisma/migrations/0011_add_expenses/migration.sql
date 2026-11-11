-- Sprint 28.1 (admin-desenvolvain.md) — despesas da barbearia, base da tela
-- Financeiro do painel. Dado do tenant (RLS normal, mesmo padrão de
-- appointments/services) — sem soft delete de propósito (decisão do
-- usuário, 11/11/2026).
CREATE TABLE "expenses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "category" VARCHAR(20) NOT NULL,
  "description" VARCHAR(255) NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "payment_method" VARCHAR(20) NOT NULL,
  "expense_date" DATE NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "expenses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "fk_expense_creator_tenant" FOREIGN KEY ("tenant_id", "created_by") REFERENCES "users"("tenant_id", "id")
);

CREATE INDEX "idx_expenses_tenant_date" ON "expenses"("tenant_id", "expense_date");

ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "expenses"
  USING ("tenant_id" = current_setting('app.current_tenant_id')::uuid);
