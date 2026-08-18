import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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

describe('Dashboard do Super Admin (/v1/admin/dashboard)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let superAdmin: { userId: string; email: string; password: string };
  let superAdminToken: string;
  let regularAdminToken: string;
  let seededTenant: SeededTenantUser;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

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
      barbersActive: expect.any(Number),
      appointmentsThisMonth: expect.any(Number),
      mrrCents: expect.any(Number),
      trialsAtivos: expect.any(Number),
      pendingPayments: expect.any(Number),
    });
  });

  it('reflete um tenant e um barbeiro ativo recém-criados na contagem', async () => {
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
      expect(after.body.barbersActive).toBe(before.body.barbersActive + 1);
    } finally {
      await cleanupTenantWithUser(prisma, tenantContext, novoTenant.tenantId);
    }
  });

  it('reflete uma assinatura ativa no MRR e nas trials ativas', async () => {
    const plan = await prisma.plan.create({ data: { code: `t${Date.now()}`.slice(0, 20), name: 'Trial teste', priceCents: 5000 } });

    const before = await request(app.getHttpServer())
      .get('/v1/admin/dashboard/overview')
      .set('Authorization', `Bearer ${superAdminToken}`);

    await tenantContext.runInTenantContext(seededTenant.tenantId, (tx) =>
      tx.subscription.create({ data: { tenantId: seededTenant.tenantId, planId: plan.id, status: 'active' } }),
    );

    try {
      const after = await request(app.getHttpServer())
        .get('/v1/admin/dashboard/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(after.body.mrrCents).toBe(before.body.mrrCents + 5000);
    } finally {
      await tenantContext.runInTenantContext(seededTenant.tenantId, (tx) =>
        tx.subscription.deleteMany({ where: { tenantId: seededTenant.tenantId } }),
      );
      await prisma.plan.delete({ where: { id: plan.id } });
    }
  });
});
