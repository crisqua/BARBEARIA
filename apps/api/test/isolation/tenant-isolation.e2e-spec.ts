// Testes de integração diretos na camada de banco/serviço (TenantContextService),
// sem HTTP/JWT — auth e rotas reais são escopo da Sprint 2. Ver seção 7 do CLAUDE.md.
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { SeededTenant, cleanupTenant, seedTenant } from '../utils/seed-test-tenants';

describe('7.1 — Isolamento básico entre tenants', () => {
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantA: SeededTenant;
  let tenantB: SeededTenant;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    tenantContext = new TenantContextService(prisma);

    tenantA = await seedTenant(prisma, tenantContext, 'iso-a');
    tenantB = await seedTenant(prisma, tenantContext, 'iso-b');
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenantContext, tenantA.tenantId);
    await cleanupTenant(prisma, tenantContext, tenantB.tenantId);
    await prisma.$disconnect();
  });

  it('lista apenas usuários do próprio tenant', async () => {
    const users = await tenantContext.runInTenantContext(tenantA.tenantId, (tx) =>
      tx.user.findMany(),
    );

    expect(users.length).toBeGreaterThan(0);
    expect(users.every((u) => u.tenantId === tenantA.tenantId)).toBe(true);
  });

  it('não consegue ler usuário de outro tenant por id (IDOR)', async () => {
    const found = await tenantContext.runInTenantContext(tenantA.tenantId, (tx) =>
      tx.user.findUnique({ where: { id: tenantB.adminId } }),
    );

    expect(found).toBeNull();
  });

  it('não consegue atualizar serviço de outro tenant', async () => {
    const result = await tenantContext.runInTenantContext(tenantA.tenantId, (tx) =>
      tx.service.updateMany({
        where: { id: tenantB.serviceId },
        data: { name: 'hackeado' },
      }),
    );

    expect(result.count).toBe(0);
  });

  it('não consegue apagar agendamento de outro tenant', async () => {
    const result = await tenantContext.runInTenantContext(tenantA.tenantId, (tx) =>
      tx.service.deleteMany({ where: { id: tenantB.serviceId } }),
    );

    expect(result.count).toBe(0);

    const stillThere = await tenantContext.runInTenantContext(tenantB.tenantId, (tx) =>
      tx.service.findUnique({ where: { id: tenantB.serviceId } }),
    );
    expect(stillThere).not.toBeNull();
  });
});
