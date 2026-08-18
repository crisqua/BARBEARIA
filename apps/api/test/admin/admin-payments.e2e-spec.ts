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

describe('Pagamentos do Super Admin (/v1/admin/tenants/:id/payments, /v1/admin/payments)', () => {
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

    seededTenant = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'pay-admin', role: 'admin' });
    const adminLogin = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: seededTenant.tenantSlug,
      email: seededTenant.email,
      password: seededTenant.password,
    });
    regularAdminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await tenantContext
      .runInTenantContext(seededTenant.tenantId, (tx) => tx.payment.deleteMany({ where: { tenantId: seededTenant.tenantId } }))
      .catch(() => {});
    await cleanupTenantWithUser(prisma, tenantContext, seededTenant.tenantId).catch(() => {});
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('admin de barbearia não pode registrar pagamento', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/tenants/${seededTenant.tenantId}/payments`)
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .send({ amountCents: 1000, period: '2026-08' });
    expect(res.status).toBe(403);
  });

  it('rejeita period fora do formato AAAA-MM', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/tenants/${seededTenant.tenantId}/payments`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ amountCents: 1000, period: '08/2026' });
    expect(res.status).toBe(400);
  });

  it('registra pagamento pendente, marca como pago (paidAt automático) e aparece na lista cross-tenant', async () => {
    const created = await request(app.getHttpServer())
      .post(`/v1/admin/tenants/${seededTenant.tenantId}/payments`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ amountCents: 29900, period: '2026-08' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: 'pending', amountCents: 29900, paidAt: null });

    const paid = await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${seededTenant.tenantId}/payments/${created.body.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'paid' });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('paid');
    expect(paid.body.paidAt).not.toBeNull();

    const list = await request(app.getHttpServer())
      .get('/v1/admin/payments')
      .query({ pageSize: 100 })
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(list.status).toBe(200);
    const found = list.body.items.find((p: { id: string }) => p.id === created.body.id);
    expect(found).toMatchObject({ status: 'paid', tenantName: `Barbearia pay-admin` });
  });
});
