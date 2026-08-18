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

describe('Atividade recente do Super Admin (/v1/admin/activity)', () => {
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

    seededTenant = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'activity-admin', role: 'admin' });
    const adminLogin = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: seededTenant.tenantSlug,
      email: seededTenant.email,
      password: seededTenant.password,
    });
    regularAdminToken = adminLogin.body.accessToken;

    const [pa, pb] = await Promise.all([
      prisma.plan.create({ data: { code: `tst-aa-${Date.now()}`, name: 'Plano A' } }),
      prisma.plan.create({ data: { code: `tst-ab-${Date.now()}`, name: 'Plano B' } }),
    ]);
    planA = pa.id;
    planB = pb.id;

    // Assinatura inicial do tenant (o create de /admin/tenants já criaria uma,
    // mas esse tenant foi seedado direto no banco, sem passar por lá).
    await tenantContext.runInTenantContext(seededTenant.tenantId, (tx) =>
      tx.subscription.create({ data: { tenantId: seededTenant.tenantId, planId: planA } }),
    );
  });

  afterAll(async () => {
    await tenantContext
      .runInTenantContext(seededTenant.tenantId, (tx) =>
        tx.platformActivity.deleteMany({ where: { tenantId: seededTenant.tenantId } }),
      )
      .catch(() => {});
    await tenantContext
      .runInTenantContext(seededTenant.tenantId, (tx) =>
        tx.payment.deleteMany({ where: { tenantId: seededTenant.tenantId } }),
      )
      .catch(() => {});
    await tenantContext
      .runInTenantContext(seededTenant.tenantId, (tx) =>
        tx.subscription.deleteMany({ where: { tenantId: seededTenant.tenantId } }),
      )
      .catch(() => {});
    await prisma.plan.deleteMany({ where: { id: { in: [planA, planB] } } }).catch(() => {});
    await cleanupTenantWithUser(prisma, tenantContext, seededTenant.tenantId).catch(() => {});
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('admin de barbearia não acessa o feed de atividade', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/activity')
      .set('Authorization', `Bearer ${regularAdminToken}`);
    expect(res.status).toBe(403);
  });

  it('troca de plano e pagamento registrado geram eventos, mais recentes primeiro', async () => {
    const planChange = await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${seededTenant.tenantId}/subscription`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ planId: planB });
    expect(planChange.status).toBe(200);

    const payment = await request(app.getHttpServer())
      .post(`/v1/admin/tenants/${seededTenant.tenantId}/payments`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ amountCents: 19900, period: '2026-08', status: 'paid' });
    expect(payment.status).toBe(201);

    const feed = await request(app.getHttpServer())
      .get('/v1/admin/activity')
      .query({ limit: 50 })
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(feed.status).toBe(200);

    const events = feed.body.filter((e: { tenantId: string }) => e.tenantId === seededTenant.tenantId);
    const actions = events.map((e: { action: string }) => e.action);
    expect(actions).toContain('plan_changed');
    expect(actions).toContain('payment_paid');

    const paymentIdx = actions.indexOf('payment_paid');
    const planIdx = actions.indexOf('plan_changed');
    expect(paymentIdx).toBeLessThan(planIdx);

    const timestamps = events.map((e: { createdAt: string }) => new Date(e.createdAt).getTime());
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
  });

  it('suspender e reativar o tenant também vira evento', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${seededTenant.tenantId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'suspended' });

    await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${seededTenant.tenantId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'active' });

    const feed = await request(app.getHttpServer())
      .get('/v1/admin/activity')
      .query({ limit: 50 })
      .set('Authorization', `Bearer ${superAdminToken}`);

    const actions = feed.body
      .filter((e: { tenantId: string }) => e.tenantId === seededTenant.tenantId)
      .map((e: { action: string }) => e.action);
    expect(actions).toContain('tenant_suspended');
    expect(actions).toContain('tenant_reactivated');
  });
});
