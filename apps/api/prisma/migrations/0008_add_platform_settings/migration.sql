-- Configuração global do painel master (Sprint pós-6, ver admin-desenvolvain.md).
-- Singleton — 1 linha só, inserida aqui mesmo, pra GET nunca dar 404. Sem
-- tenant_id, sem RLS (dado da plataforma, mesmo raciocínio de `plans`).
CREATE TABLE "platform_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domain" VARCHAR(255) NOT NULL,
  "support_email" VARCHAR(255) NOT NULL,
  "webhook_url" VARCHAR(2048) NOT NULL,
  "default_trial_days" INTEGER NOT NULL,
  "bg_color" VARCHAR(7) NOT NULL,
  "accent_color" VARCHAR(7) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_settings"
  ("domain", "support_email", "webhook_url", "default_trial_days", "bg_color", "accent_color")
VALUES
  ('barberaria.app', 'suporte@desenvolvain.com', 'https://api.barberaria.app/webhooks/pay', 14, '#080B12', '#A3E635');
