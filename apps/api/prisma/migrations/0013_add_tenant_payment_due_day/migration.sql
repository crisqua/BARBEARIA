-- Sprint 30 (admin-desenvolvain.md) — dia de vencimento mensal por barbearia,
-- usado pra calcular status de cobrança (em dia / em atraso / sem cobrança).
-- DEFAULT 10 preenche as barbearias já existentes sem precisar de UPDATE
-- separado. `tenants` não tem RLS (exceção documentada, seção 6.4) — nenhuma
-- policy nova aqui é o esperado.
ALTER TABLE "tenants" ADD COLUMN "payment_due_day" INTEGER NOT NULL DEFAULT 10;
