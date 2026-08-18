-- Feed de eventos pra "Atividade recente" do Dashboard do painel master —
-- dado do tenant, RLS normal, mesma decisão de subscriptions/payments/
-- payouts (Sprint 5). Leitura cross-tenant do Super Admin soma por tenant
-- via TenantContextService, mesmo mecanismo de sempre.
CREATE TABLE "platform_activities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "platform_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
);

CREATE INDEX "idx_platform_activities_tenant" ON "platform_activities"("tenant_id", "created_at");

ALTER TABLE "platform_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_activities" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "platform_activities"
  USING ("tenant_id" = current_setting('app.current_tenant_id')::uuid);
