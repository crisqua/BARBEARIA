-- Assinatura do tenant a um plano (Sprint 5 do painel master DesenvolvaIN,
-- ver admin-desenvolvain.md). Diferente de `plans` (catálogo global, sem
-- RLS): `subscriptions` é dado do tenant — RLS normal, mesmo padrão estrito
-- de `services`/`appointments` (sem missing_ok, ver comentário da migration
-- 0002). Leitura cross-tenant do Super Admin soma por tenant via
-- TenantContextService, mesmo mecanismo já usado nos Sprints 2 e 3 — não é
-- mais uma exceção de RLS documentada.
CREATE TABLE "subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id")
);

CREATE UNIQUE INDEX "subscriptions_tenant_id_key" ON "subscriptions"("tenant_id");

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "subscriptions"
  USING ("tenant_id" = current_setting('app.current_tenant_id')::uuid);
