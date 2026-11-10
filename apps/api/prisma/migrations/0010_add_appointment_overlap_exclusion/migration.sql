-- Sprint 22 (admin-desenvolvain.md) — o indice unico idx_no_double_booking
-- (migration 0001_init) so impede starts_at identico para o mesmo
-- profissional, nao sobreposicao de intervalo (ex: 14:00-14:45 e
-- 14:30-15:15 se cruzam, mas tem starts_at diferente). Essa constraint
-- de exclusao com btree_gist cobre o caso real de sobreposicao, no nivel
-- do banco (concorrencia real entre pessoas disputando o mesmo
-- profissional) - mesma categoria de protecao que o indice acima,
-- generalizada pra intervalos de tempo.
--
-- tstzrange, nao tsrange: starts_at/ends_at sao TIMESTAMPTZ (seção 4,
-- "decisões conscientemente adiadas" do CLAUDE.md - timezone nao
-- modelado no schema, tratado como hora local da barbearia sem
-- conversao) - tsrange so aceita TIMESTAMP sem timezone, falha com
-- TIMESTAMPTZ.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "appointments" ADD CONSTRAINT "no_overlap_appointments"
  EXCLUDE USING gist (
    "tenant_id" WITH =,
    "professional_id" WITH =,
    tstzrange("starts_at", "ends_at") WITH &&
  ) WHERE ("status" = 'scheduled');
