import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Cria (se não existir) a role de aplicação usada pela API/testes em runtime.
 *
 * Isso importa porque `ALTER TABLE ... FORCE ROW LEVEL SECURITY` (migration 0001)
 * não tem efeito sobre roles com o atributo BYPASSRLS — e a role bootstrap do
 * Postgres local (docker-compose) e de alguns provedores é superuser, que sempre
 * bypassa RLS independente de FORCE. Sem essa role restrita, os testes de
 * isolamento (seção 7 do CLAUDE.md) passariam mesmo que o RLS estivesse quebrado.
 *
 * DIRECT_URL (privilegiada) roda este script. DATABASE_URL deve apontar para
 * a role criada aqui (`barberaria_app`) — é essa conexão que TenantContextService
 * e os testes usam para de fato exercitar o RLS.
 */
const APP_ROLE = 'barberaria_app';
const APP_ROLE_PASSWORD = process.env.APP_ROLE_PASSWORD ?? 'barberaria_app';

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DIRECT_URL (ou DATABASE_URL) não configurada.');
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
          CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_ROLE_PASSWORD}'
            NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE};`);
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE};`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE};`,
    );

    console.log(`Role "${APP_ROLE}" pronta (NOSUPERUSER, NOBYPASSRLS) — RLS será respeitado.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
