import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { SeededTenant, cleanupTenant, seedTenant } from '../utils/seed-test-tenants';

describe('7.6 — FK composta em expenses (Sprint 28)', () => {
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantA: SeededTenant;
  let tenantB: SeededTenant;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    tenantContext = new TenantContextService(prisma);

    tenantA = await seedTenant(prisma, tenantContext, 'fk-exp-a');
    tenantB = await seedTenant(prisma, tenantContext, 'fk-exp-b');
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenantContext, tenantA.tenantId);
    await cleanupTenant(prisma, tenantContext, tenantB.tenantId);
    await prisma.$disconnect();
  });

  it('despesa do tenant A com created_by de admin do tenant B falha por FK composta', async () => {
    await expect(
      tenantContext.runInTenantContext(tenantA.tenantId, (tx) =>
        tx.expense.create({
          data: {
            tenantId: tenantA.tenantId,
            createdBy: tenantB.adminId,
            category: 'insumos',
            description: 'Produto',
            amountCents: 1000,
            paymentMethod: 'pix',
            expenseDate: new Date('2026-11-10'),
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('despesa dentro do mesmo tenant funciona normalmente', async () => {
    const created = await tenantContext.runInTenantContext(tenantA.tenantId, (tx) =>
      tx.expense.create({
        data: {
          tenantId: tenantA.tenantId,
          createdBy: tenantA.adminId,
          category: 'insumos',
          description: 'Produto',
          amountCents: 1000,
          paymentMethod: 'pix',
          expenseDate: new Date('2026-11-10'),
        },
      }),
    );

    expect(created.tenantId).toBe(tenantA.tenantId);
  });
});
