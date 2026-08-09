import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

/**
 * Bootstrap do primeiro Super Admin. Não existe (nem deveria existir) uma
 * rota pública para criar super_admin — só via este script, rodado por quem
 * tem acesso ao banco.
 */
async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const name = process.env.SEED_SUPER_ADMIN_NAME ?? 'Super Admin';

  if (!email || !password) {
    throw new Error(
      'Defina SEED_SUPER_ADMIN_EMAIL e SEED_SUPER_ADMIN_PASSWORD antes de rodar este script.',
    );
  }
  if (password.length < 8) {
    throw new Error('SEED_SUPER_ADMIN_PASSWORD precisa ter pelo menos 8 caracteres.');
  }

  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findFirst({ where: { role: 'super_admin', email } });
    if (existing) {
      console.log(`Super Admin "${email}" já existe (id=${existing.id}). Nada a fazer.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const created = await prisma.user.create({
      data: { tenantId: null, role: 'super_admin', name, email, passwordHash },
    });

    console.log(`Super Admin criado: id=${created.id} email=${created.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
