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

describe('Assinaturas do Super Admin (/v1/admin/tenants/:id/subscription, /v1/admin/subscriptions)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let superAdmin: { userId: string; email: string; password: string };
  let superAdminToken: string;
  let regularAdminToken: string;
  let seededTenant: SeededTenantUser;
  let planA: string;
  let planB: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    superAdmin = await seedSuperAdmin(prisma);
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: superAdmin.email, password: superAdmin.password });
    superAdminToken = loginRes.body.accessToken;

    seededTenant = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'sub-admin', role: 'admin' });
    const adminLogin = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: seededTenant.tenantSlug,
      email: seededTenant.email,
      password: seededTenant.password,
    });
    regularAdminToken = adminLogin.body.accessToken;

    const [pa, pb] = await Promise.all([
      prisma.plan.create({ data: { code: `test-a-${Date.now()}`, name: 'Plano A' } }),
      prisma.plan.create({ data: { code: `test-b-${Date.now()}`, name: 'Plano B' } }),
    ]);
    planA = pa.id;
    planB = pb.id;
  });

  afterAll(async () => {
    await tenantContext
      .runInTenantContext(seededTenant.tenantId, (tx) => tx.subscription.deleteMany({ where: { tenantId: seededTenant.tenantId } }))
      .catch(() => {});
    await prisma.plan.deleteMany({ where: { id: { in: [planA, planB] } } }).catch(() => {});
    await cleanupTenantWithUser(prisma, tenantContext, seededTenant.tenantId).catch(() => {});
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('admin de barbearia não acessa as rotas de assinatura', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/admin/tenants/${seededTenant.tenantId}/subscription`)
      .set('Authorization', `Bearer ${regularAdminToken}`);
    expect(res.status).toBe(403);
  });

  it('tenant sem assinatura ainda: GET 404, PATCH sem planId 400', async () => {
    const getRes = await request(app.getHttpServer())
      .get(`/v1/admin/tenants/${seededTenant.tenantId}/subscription`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(getRes.status).toBe(404);

    const patchRes = await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${seededTenant.tenantId}/subscription`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'active' });
    expect(patchRes.status).toBe(400);
  });

  it('cria a assinatura via PATCH (upsert), troca de plano e cancela', async () => {
    const created = await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${seededTenant.tenantId}/subscription`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ planId: planA });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ tenantId: seededTenant.tenantId, planId: planA, status: 'active' });

    const trocado = await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${seededTenant.tenantId}/subscription`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ planId: planB });
    expect(trocado.body.planId).toBe(planB);

    const cancelado = await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${seededTenant.tenantId}/subscription`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'cancelled' });
    expect(cancelado.body).toMatchObject({ status: 'cancelled', planId: planB });

    const get = await request(app.getHttpServer())
      .get(`/v1/admin/tenants/${seededTenant.tenantId}/subscription`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(get.status).toBe(200);
    expect(get.body.plan).toMatchObject({ id: planB, name: 'Plano B' });
  });

  it('lista cross-tenant paginada inclui o tenant e a assinatura dele', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/subscriptions')
      .query({ pageSize: 100 })
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 100, total: expect.any(Number) });
    const entry = res.body.items.find((i: { tenant: { id: string } }) => i.tenant.id === seededTenant.tenantId);
    expect(entry.subscription).toMatchObject({ planId: planB, status: 'cancelled' });
  });

  it('rejeita plano inexistente', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${seededTenant.tenantId}/subscription`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ planId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });
});
