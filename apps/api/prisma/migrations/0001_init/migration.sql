-- Migration inicial — schema fechado na seção 5 do CLAUDE.md.
-- Inclui, na MESMA migration (por instrução da seção 10 do CLAUDE.md):
--   * tabelas + FKs simples (via Prisma)
--   * FKs compostas (tenant_id, professional_id/service_id/client_id) — integridade cross-tenant
--   * CHECK constraint do Super Admin sem tenant
--   * índice anti-double-booking (seção 5.3)
--   * RLS + policies de tenant_isolation em toda tabela de negócio (seção 5.4), exceto `tenants`

-- ═══════════════════════════════════════════
-- TENANTS — fora do RLS por decisão da seção 6.4 (Super Admin precisa ver todos os tenants)
-- ═══════════════════════════════════════════
CREATE TABLE "tenants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" VARCHAR(63) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "primary_color" VARCHAR(7) NOT NULL DEFAULT '#C9A84C',
  "secondary_color" VARCHAR(7) NOT NULL DEFAULT '#0F0F0F',
  "logo_url" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- ═══════════════════════════════════════════
-- USERS
-- ═══════════════════════════════════════════
CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "role" VARCHAR(20) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(20),
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "chk_super_admin_no_tenant" CHECK (
    ("role" = 'super_admin' AND "tenant_id" IS NULL) OR
    ("role" != 'super_admin' AND "tenant_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");
CREATE UNIQUE INDEX "users_tenant_id_id_key" ON "users"("tenant_id", "id");
CREATE INDEX "idx_users_tenant" ON "users"("tenant_id", "role");

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "users"
  USING ("tenant_id" = current_setting('app.current_tenant_id')::uuid);

-- ═══════════════════════════════════════════
-- SERVICES
-- ═══════════════════════════════════════════
CREATE TABLE "services" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "price_cents" INTEGER NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
);

CREATE UNIQUE INDEX "services_tenant_id_id_key" ON "services"("tenant_id", "id");
CREATE INDEX "idx_services_tenant" ON "services"("tenant_id", "active");

ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "services"
  USING ("tenant_id" = current_setting('app.current_tenant_id')::uuid);

-- ═══════════════════════════════════════════
-- PROFESSIONAL_SERVICES
-- FK composta garante que professional_id e service_id pertencem ao MESMO
-- tenant_id da linha — não apenas que existem em algum tenant.
-- ═══════════════════════════════════════════
CREATE TABLE "professional_services" (
  "tenant_id" UUID NOT NULL,
  "professional_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,

  CONSTRAINT "professional_services_pkey" PRIMARY KEY ("professional_id", "service_id"),
  CONSTRAINT "professional_services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "fk_prof_tenant" FOREIGN KEY ("tenant_id", "professional_id") REFERENCES "users"("tenant_id", "id"),
  CONSTRAINT "fk_service_tenant" FOREIGN KEY ("tenant_id", "service_id") REFERENCES "services"("tenant_id", "id")
);

ALTER TABLE "professional_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "professional_services" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "professional_services"
  USING ("tenant_id" = current_setting('app.current_tenant_id')::uuid);

-- ═══════════════════════════════════════════
-- WORKING_HOURS
-- ═══════════════════════════════════════════
CREATE TABLE "working_hours" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "professional_id" UUID NOT NULL,
  "weekday" SMALLINT NOT NULL,
  "start_time" TIME NOT NULL,
  "end_time" TIME NOT NULL,

  CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "working_hours_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "fk_working_hours_prof_tenant" FOREIGN KEY ("tenant_id", "professional_id") REFERENCES "users"("tenant_id", "id")
);

ALTER TABLE "working_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "working_hours" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "working_hours"
  USING ("tenant_id" = current_setting('app.current_tenant_id')::uuid);

-- ═══════════════════════════════════════════
-- APPOINTMENTS (núcleo do MVP)
-- FK composta tripla: client, professional e service precisam pertencer
-- ao mesmo tenant da linha.
-- ═══════════════════════════════════════════
CREATE TABLE "appointments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "professional_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "starts_at" TIMESTAMPTZ NOT NULL,
  "ends_at" TIMESTAMPTZ NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "fk_appt_client_tenant" FOREIGN KEY ("tenant_id", "client_id") REFERENCES "users"("tenant_id", "id"),
  CONSTRAINT "fk_appt_prof_tenant" FOREIGN KEY ("tenant_id", "professional_id") REFERENCES "users"("tenant_id", "id"),
  CONSTRAINT "fk_appt_service_tenant" FOREIGN KEY ("tenant_id", "service_id") REFERENCES "services"("tenant_id", "id")
);

CREATE INDEX "idx_appointments_tenant_date" ON "appointments"("tenant_id", "starts_at");
CREATE INDEX "idx_appointments_professional" ON "appointments"("tenant_id", "professional_id", "starts_at");
CREATE INDEX "idx_appointments_client" ON "appointments"("tenant_id", "client_id", "starts_at");

-- Anti-double-booking (seção 5.3): impede dois agendamentos concorrentes com o
-- mesmo starts_at exato para o mesmo profissional. Não cobre overlap de intervalo
-- (débito técnico documentado — ver seção 4 do CLAUDE.md, solução com btree_gist adiada).
CREATE UNIQUE INDEX "idx_no_double_booking"
  ON "appointments" ("tenant_id", "professional_id", "starts_at")
  WHERE "status" = 'scheduled';

ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "appointments"
  USING ("tenant_id" = current_setting('app.current_tenant_id')::uuid);
