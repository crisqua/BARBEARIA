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

export interface SeededUser {
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

  const { userId, email, password } = await seedUserInTenant(
    prisma,
    tenantContext,
    tenant.id,
    opts.role,
    opts.password,
  );

  return { tenantId: tenant.id, tenantSlug: tenant.slug, userId, email, password };
}

/** Adiciona um usuário a um tenant JÁ EXISTENTE — use quando precisar de dois
 * papéis no MESMO tenant (ex: admin + cliente vendo os mesmos dados). */
export async function seedUserInTenant(
  prisma: PrismaService,
  tenantContext: TenantContextService,
  tenantId: string,
  role: 'admin' | 'barbeiro' | 'cliente',
  password = 'senha-forte-123',
): Promise<SeededUser> {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const email = `${role}-${uniqueSuffix}@test.local`;

  const user = await tenantContext.runInTenantContext(tenantId, (tx) =>
    tx.user.create({ data: { tenantId, role, name: 'Fixture', email, passwordHash } }),
  );

  return { userId: user.id, email, password };
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
  await tenantContext.runInTenantContext(tenantId, async (tx) => {
    await tx.appointment.deleteMany({ where: { tenantId } });
    await tx.workingHour.deleteMany({ where: { tenantId } });
    await tx.professionalService.deleteMany({ where: { tenantId } });
    await tx.service.deleteMany({ where: { tenantId } });
    await tx.user.deleteMany({ where: { tenantId } });
  });
  await prisma.tenant.delete({ where: { id: tenantId } });
}

export async function cleanupSuperAdmin(prisma: PrismaService, userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}
