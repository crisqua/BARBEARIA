-- Sprint 28.3 (admin-desenvolvain.md) — categorias de despesa cadastraveis por
-- tenant, além das 3 fixas no código. expenses.category vira texto livre
-- (antes fechado em insumos|fixas|outras via validação de aplicação) — a
-- coluna precisa ser alargada pra caber nomes customizados mais longos.
ALTER TABLE "expenses" ALTER COLUMN "category" TYPE VARCHAR(50);

CREATE TABLE "expense_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "expense_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "expense_categories_tenant_id_name_key" UNIQUE ("tenant_id", "name")
);

ALTER TABLE "expense_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense_categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "expense_categories"
  USING ("tenant_id" = current_setting('app.current_tenant_id')::uuid);
