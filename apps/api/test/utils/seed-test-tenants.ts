import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';

export interface SeededTenant {
  tenantId: string;
  adminId: string;
  professionalId: string;
  clientId: string;
  serviceId: string;
}

export async function seedTenant(
  prisma: PrismaService,
  tenantContext: TenantContextService,
  slugPrefix: string,
): Promise<SeededTenant> {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // `tenants` não tem RLS (seção 6.4) — client global, sem tenant context.
  const tenant = await prisma.tenant.create({
    data: { slug: `${slugPrefix}-${uniqueSuffix}`, name: `Barbearia ${slugPrefix}` },
  });

  // users/services têm RLS com FORCE — mesmo pra seed de teste, o insert precisa
  // passar pelo tenant context (SET LOCAL), senão o WITH CHECK barra a escrita.
  const { adminId, professionalId, clientId, serviceId } = await tenantContext.runInTenantContext(
    tenant.id,
    async (tx) => {
      const admin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          role: 'admin',
          name: 'Admin',
          email: `admin-${tenant.id}@test.local`,
          passwordHash: 'x',
        },
      });

      const professional = await tx.user.create({
        data: {
          tenantId: tenant.id,
          role: 'barbeiro',
          name: 'Barbeiro',
          email: `barbeiro-${tenant.id}@test.local`,
          passwordHash: 'x',
        },
      });

      const client = await tx.user.create({
        data: {
          tenantId: tenant.id,
          role: 'cliente',
          name: 'Cliente',
          email: `cliente-${tenant.id}@test.local`,
          passwordHash: 'x',
        },
      });

      const service = await tx.service.create({
        data: { tenantId: tenant.id, name: 'Corte', priceCents: 5000, durationMinutes: 30 },
      });

      return {
        adminId: admin.id,
        professionalId: professional.id,
        clientId: client.id,
        serviceId: service.id,
      };
    },
  );

  return { tenantId: tenant.id, adminId, professionalId, clientId, serviceId };
}

export async function cleanupTenant(
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
