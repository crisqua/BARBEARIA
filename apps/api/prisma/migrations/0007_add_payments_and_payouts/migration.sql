-- Pagamentos de assinatura e repasses de receita (Sprint 6 do painel master
-- DesenvolvaIN, ver admin-desenvolvain.md). Dado do tenant — RLS normal,
-- mesmo padrão de subscriptions (Sprint 5): sem exceção de RLS documentada,
-- leitura cross-tenant do Super Admin soma por tenant via
-- TenantContextService. Ambas são registro manual (sem gateway de
-- pagamento, sem motor de cálculo de repasse automático).
CREATE TABLE "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "subscription_id" UUID,
  "amount_cents" INTEGER NOT NULL,
  "period" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "paid_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id")
);

CREATE INDEX "idx_payments_tenant" ON "payments"("tenant_id", "created_at");

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "payments"
  USING ("tenant_id" = current_setting('app.current_tenant_id')::uuid);

CREATE TABLE "payouts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "period" VARCHAR(50) NOT NULL,
  "gross_revenue_cents" INTEGER NOT NULL,
  "fee_pct" DECIMAL(5,2) NOT NULL,
  "net_cents" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "payouts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payouts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
);

CREATE INDEX "idx_payouts_tenant" ON "payouts"("tenant_id", "created_at");

ALTER TABLE "payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payouts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "payouts"
  USING ("tenant_id" = current_setting('app.current_tenant_id')::uuid);
