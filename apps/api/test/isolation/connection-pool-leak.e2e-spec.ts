// Teste mais crítico da Sprint 1 (seção 6.3/7.7 do CLAUDE.md): prova que, mesmo
// disparando muitas transações concorrentes que reaproveitam conexões do pool do
// Prisma, o `SET LOCAL` (set_config(..., true)) nunca vaza tenant_id de uma
// transação para outra.
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { SeededTenant, cleanupTenant, seedTenant } from '../utils/seed-test-tenants';

describe('7.7 — Vazamento de contexto sob connection pooling', () => {
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantA: SeededTenant;
  let tenantB: SeededTenant;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    tenantContext = new TenantContextService(prisma);

    tenantA = await seedTenant(prisma, tenantContext, 'pool-a');
    tenantB = await seedTenant(prisma, tenantContext, 'pool-b');
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenantContext, tenantA.tenantId);
    await cleanupTenant(prisma, tenantContext, tenantB.tenantId);
    await prisma.$disconnect();
  });

  it('nenhuma das requisições concorrentes vê dado de outro tenant', async () => {
    const iterations = 40;

    const calls = Array.from({ length: iterations }, (_, i) => {
      const tenant = i % 2 === 0 ? tenantA : tenantB;
      return tenantContext.runInTenantContext(tenant.tenantId, async (tx) => {
        const users = await tx.user.findMany();
        return { expectedTenantId: tenant.tenantId, users };
      });
    });

    const results = await Promise.all(calls);

    for (const { expectedTenantId, users } of results) {
      expect(users.length).toBeGreaterThan(0);
      expect(users.every((u) => u.tenantId === expectedTenantId)).toBe(true);
    }
  });
});
