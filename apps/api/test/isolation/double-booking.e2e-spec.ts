import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { SeededTenant, cleanupTenant, seedTenant } from '../utils/seed-test-tenants';

describe('7.8 — Concorrência no agendamento (anti-double-booking)', () => {
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantA: SeededTenant;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    tenantContext = new TenantContextService(prisma);

    tenantA = await seedTenant(prisma, tenantContext, 'double-booking-a');
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenantContext, tenantA.tenantId);
    await prisma.$disconnect();
  });

  it('apenas um agendamento é aceito para o mesmo profissional/horário exato', async () => {
    const startsAt = new Date('2026-09-01T14:00:00Z');
    const endsAt = new Date('2026-09-01T14:30:00Z');

    const attempt = () =>
      tenantContext.runInTenantContext(tenantA.tenantId, (tx) =>
        tx.appointment.create({
          data: {
            tenantId: tenantA.tenantId,
            clientId: tenantA.clientId,
            professionalId: tenantA.professionalId,
            serviceId: tenantA.serviceId,
            startsAt,
            endsAt,
          },
        }),
      );

    const results = await Promise.allSettled([attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});
