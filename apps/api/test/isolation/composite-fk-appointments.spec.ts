import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { SeededTenant, cleanupTenant, seedTenant } from '../utils/seed-test-tenants';

describe('7.6 — FK composta em appointments', () => {
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantA: SeededTenant;
  let tenantB: SeededTenant;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    tenantContext = new TenantContextService(prisma);

    tenantA = await seedTenant(prisma, tenantContext, 'fk-appt-a');
    tenantB = await seedTenant(prisma, tenantContext, 'fk-appt-b');
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenantContext, tenantA.tenantId);
    await cleanupTenant(prisma, tenantContext, tenantB.tenantId);
    await prisma.$disconnect();
  });

  it('agendamento com client do tenant A e service do tenant B falha por FK composta', async () => {
    await expect(
      tenantContext.runInTenantContext(tenantA.tenantId, (tx) =>
        tx.appointment.create({
          data: {
            tenantId: tenantA.tenantId,
            clientId: tenantA.clientId,
            professionalId: tenantA.professionalId,
            serviceId: tenantB.serviceId,
            startsAt: new Date('2026-09-02T10:00:00Z'),
            endsAt: new Date('2026-09-02T10:30:00Z'),
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('agendamento com professional de outro tenant falha por FK composta', async () => {
    await expect(
      tenantContext.runInTenantContext(tenantA.tenantId, (tx) =>
        tx.appointment.create({
          data: {
            tenantId: tenantA.tenantId,
            clientId: tenantA.clientId,
            professionalId: tenantB.professionalId,
            serviceId: tenantA.serviceId,
            startsAt: new Date('2026-09-02T11:00:00Z'),
            endsAt: new Date('2026-09-02T11:30:00Z'),
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('agendamento dentro do mesmo tenant funciona normalmente', async () => {
    const created = await tenantContext.runInTenantContext(tenantA.tenantId, (tx) =>
      tx.appointment.create({
        data: {
          tenantId: tenantA.tenantId,
          clientId: tenantA.clientId,
          professionalId: tenantA.professionalId,
          serviceId: tenantA.serviceId,
          startsAt: new Date('2026-09-02T12:00:00Z'),
          endsAt: new Date('2026-09-02T12:30:00Z'),
        },
      }),
    );

    expect(created.tenantId).toBe(tenantA.tenantId);
  });
});
