import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';

// Custo baixo só nos testes, pra velocidade — nunca usar isso em produção.
const BCRYPT_ROUNDS = 4;

export interface SeededTenantUser {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  email: string;
  password: string;
}

export async function seedTenantWithUser(
  prisma: PrismaService,
  tenantContext: TenantContextService,
  opts: { slugPrefix: string; role: 'admin' | 'barbeiro' | 'cliente'; password?: string },
): Promise<SeededTenantUser> {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tenant = await prisma.tenant.create({
    data: { slug: `${opts.slugPrefix}-${uniqueSuffix}`, name: `Barbearia ${opts.slugPrefix}` },
  });

  const password = opts.password ?? 'senha-forte-123';
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const email = `${opts.role}-${tenant.id}@test.local`;

  const user = await tenantContext.runInTenantContext(tenant.id, (tx) =>
    tx.user.create({
      data: { tenantId: tenant.id, role: opts.role, name: 'Fixture', email, passwordHash },
    }),
  );

  return { tenantId: tenant.id, tenantSlug: tenant.slug, userId: user.id, email, password };
}

export async function seedSuperAdmin(
  prisma: PrismaService,
  opts: { password?: string } = {},
): Promise<{ userId: string; email: string; password: string }> {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = opts.password ?? 'senha-super-admin-123';
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const email = `super-admin-${uniqueSuffix}@test.local`;

  const user = await prisma.user.create({
    data: { tenantId: null, role: 'super_admin', name: 'Super Admin Fixture', email, passwordHash },
  });

  return { userId: user.id, email, password };
}

export async function cleanupTenantWithUser(
  prisma: PrismaService,
  tenantContext: TenantContextService,
  tenantId: string,
): Promise<void> {
  await tenantContext.runInTenantContext(tenantId, (tx) => tx.user.deleteMany({ where: { tenantId } }));
  await prisma.tenant.delete({ where: { id: tenantId } });
}

export async function cleanupSuperAdmin(prisma: PrismaService, userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}
