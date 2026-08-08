import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { SeededTenant, cleanupTenant, seedTenant } from '../utils/seed-test-tenants';

describe('7.5 — FK composta em professional_services', () => {
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantA: SeededTenant;
  let tenantB: SeededTenant;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    tenantContext = new TenantContextService(prisma);

    tenantA = await seedTenant(prisma, tenantContext, 'fk-ps-a');
    tenantB = await seedTenant(prisma, tenantContext, 'fk-ps-b');
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenantContext, tenantA.tenantId);
    await cleanupTenant(prisma, tenantContext, tenantB.tenantId);
    await prisma.$disconnect();
  });

  it('associar profissional do tenant A com serviço do tenant B falha por FK composta', async () => {
    await expect(
      tenantContext.runInTenantContext(tenantA.tenantId, (tx) =>
        tx.professionalService.create({
          data: {
            tenantId: tenantA.tenantId,
            professionalId: tenantA.professionalId,
            serviceId: tenantB.serviceId,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('associação dentro do mesmo tenant funciona normalmente', async () => {
    const created = await tenantContext.runInTenantContext(tenantA.tenantId, (tx) =>
      tx.professionalService.create({
        data: {
          tenantId: tenantA.tenantId,
          professionalId: tenantA.professionalId,
          serviceId: tenantA.serviceId,
        },
      }),
    );

    expect(created.tenantId).toBe(tenantA.tenantId);
  });
});
