import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CacheService } from '../../src/cache/cache.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import {
  SeededTenantUser,
  cleanupSuperAdmin,
  cleanupTenantWithUser,
  seedSuperAdmin,
  seedTenantWithUser,
} from '../utils/seed-auth-fixtures';

const SUBSCRIPTIONS_CACHE_KEY = 'admin:subscriptions:all';

describe('Dashboard do Super Admin (/v1/admin/dashboard)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let cache: CacheService;
  let superAdmin: { userId: string; email: string; password: string };
  let superAdminToken: string;
  let regularAdminToken: string;
  let seededTenant: SeededTenantUser;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);
    cache = app.get(CacheService);

    superAdmin = await seedSuperAdmin(prisma);
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: superAdmin.email, password: superAdmin.password });
    superAdminToken = loginRes.body.accessToken;

    seededTenant = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'dash-admin', role: 'admin' });
    const adminLogin = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: seededTenant.tenantSlug,
      email: seededTenant.email,
      password: seededTenant.password,
    });
    regularAdminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, seededTenant.tenantId).catch(() => {});
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('admin de barbearia não pode acessar o overview', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/dashboard/overview')
      .set('Authorization', `Bearer ${regularAdminToken}`);
    expect(res.status).toBe(403);
  });

  it('retorna contagens agregadas com o shape esperado', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/dashboard/overview')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      tenants: {
        total: expect.any(Number),
        active: expect.any(Number),
        suspended: expect.any(Number),
      },
      mrrCents: expect.any(Number),
      trialsAtivos: expect.any(Number),
      tenantsByPlan: expect.any(Array),
    });
  });

  it('reflete um tenant recém-criado na contagem', async () => {
    const before = await request(app.getHttpServer())
      .get('/v1/admin/dashboard/overview')
      .set('Authorization', `Bearer ${superAdminToken}`);

    const novoTenant = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'dash-barbeiro', role: 'barbeiro' });

    try {
      const after = await request(app.getHttpServer())
        .get('/v1/admin/dashboard/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(after.body.tenants.total).toBe(before.body.tenants.total + 1);
      expect(after.body.tenants.active).toBe(before.body.tenants.active + 1);
    } finally {
      await cleanupTenantWithUser(prisma, tenantContext, novoTenant.tenantId);
    }
  });

  /**
   * MRR/trials/tenantsByPlan agora vêm do cache de AdminSubscriptionsService
   * (Sprint 7) — criar a assinatura direto via Prisma (como esse teste fazia
   * antes) não invalidaria o cache, e o teste cairia na mesma armadilha do
   * incidente de cache de setembro (servir dado velho). Por isso a criação
   * passa pelo endpoint real, que já invalida.
   */
  it('reflete uma assinatura ativa no MRR e na distribuição por plano', async () => {
    const plan = await prisma.plan.create({ data: { code: `t${Date.now()}`.slice(0, 20), name: 'Trial teste', priceCents: 5000 } });

    const before = await request(app.getHttpServer())
      .get('/v1/admin/dashboard/overview')
      .set('Authorization', `Bearer ${superAdminToken}`);

    await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${seededTenant.tenantId}/subscription`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ planId: plan.id, status: 'active' });

    try {
      const after = await request(app.getHttpServer())
        .get('/v1/admin/dashboard/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(after.body.mrrCents).toBe(before.body.mrrCents + 5000);

      const planeEntry = after.body.tenantsByPlan.find((p: { planCode: string }) => p.planCode === plan.code);
      expect(planeEntry).toMatchObject({ planCode: plan.code, planName: 'Trial teste', count: 1 });
    } finally {
      await tenantContext.runInTenantContext(seededTenant.tenantId, (tx) =>
        tx.subscription.deleteMany({ where: { tenantId: seededTenant.tenantId } }),
      );
      await prisma.plan.delete({ where: { id: plan.id } });
      // Limpa raw (sem passar pelo endpoint) — invalida manualmente pra não
      // deixar o cache compartilhado com uma assinatura já apagada pros
      // próximos arquivos de teste que rodam no mesmo processo (--runInBand).
      await cache.del(SUBSCRIPTIONS_CACHE_KEY);
    }
  });
});
