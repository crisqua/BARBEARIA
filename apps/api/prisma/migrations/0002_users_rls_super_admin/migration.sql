-- Corrige a policy de RLS de `users` para acomodar o Super Admin.
--
-- A CHECK constraint (migration 0001) permite tenant_id IS NULL só para
-- role = 'super_admin'. Mas a policy original (`tenant_id = current_setting(...)::uuid`)
-- nunca é TRUE para tenant_id NULL — `NULL = x` é NULL, não TRUE — então o Super
-- Admin nunca conseguia ser lido/escrito, nem fora de um tenant context.
--
-- O login do Super Admin roda fora de qualquer transação de tenant context
-- (igual as rotas /admin/*, seção 6.4 do CLAUDE.md). Mas em conexão reaproveitada
-- de pool (Supavisor/PgBouncer), depois que `app.current_tenant_id` foi setado
-- pelo menos uma vez nessa conexão física via SET LOCAL, o Postgres não volta pra
-- NULL de verdade no fim da transação — volta pra STRING VAZIA (comportamento de
-- GUC customizado, verificado empiricamente). Um `current_setting(..., true)::uuid`
-- direto quebraria com "invalid input syntax for type uuid" nesse caso. Por isso o
-- NULLIF: normaliza '' e NULL pro mesmo valor antes do cast, nos dois braços do OR.
-- As demais tabelas continuam com a versão estrita (sem missing_ok), preservando
-- o "falha alto" da Sprint 1 — lá, um cast de '' ainda gera erro, só que com uma
-- mensagem diferente; a propriedade de segurança (nunca falha em aberto) não muda.
DROP POLICY "tenant_isolation" ON "users";
CREATE POLICY "tenant_isolation" ON "users"
  USING (
    "tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR ("tenant_id" IS NULL AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
  );
