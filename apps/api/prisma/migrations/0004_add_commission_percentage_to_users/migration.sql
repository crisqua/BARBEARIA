-- Adiciona percentual de comissão ao profissional (users.role = 'barbeiro').
--
-- Campo puramente cadastral (armazenar/exibir no CRUD de profissionais) — sem
-- cálculo automático de comissão sobre agendamentos, que fica fora do MVP.
-- Nullable: profissional pode ser criado sem comissão definida.
--
-- Mesmo padrão de 0003_add_active_to_users: aplica-se à tabela `users` inteira
-- por simplicidade, e nenhuma policy de RLS muda (só adiciona coluna).
ALTER TABLE "users" ADD COLUMN "commission_percentage" DECIMAL(5,2);
