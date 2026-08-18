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

describe('Repasses do Super Admin (/v1/admin/tenants/:id/payouts, /v1/admin/payouts)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let superAdmin: { userId: string; email: string; password: string };
  let superAdminToken: string;
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

    seededTenant = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'payout-admin', role: 'admin' });
  });

  afterAll(async () => {
    await tenantContext
      .runInTenantContext(seededTenant.tenantId, (tx) => tx.payout.deleteMany({ where: { tenantId: seededTenant.tenantId } }))
      .catch(() => {});
    await cleanupTenantWithUser(prisma, tenantContext, seededTenant.tenantId).catch(() => {});
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('calcula o líquido corretamente (bruto - taxa%) e não decide a taxa sozinho', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/tenants/${seededTenant.tenantId}/payouts`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ period: 'Agosto 2026', grossRevenueCents: 434000, feePct: 15 });

    expect(res.status).toBe(201);
    // 434000 * 0.85 = 368900
    expect(res.body).toMatchObject({ grossRevenueCents: 434000, feePct: 15, netCents: 368900, status: 'pending' });
  });

  it('marca como pago e aparece na lista cross-tenant', async () => {
    const created = await request(app.getHttpServer())
      .post(`/v1/admin/tenants/${seededTenant.tenantId}/payouts`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ period: 'Setembro 2026', grossRevenueCents: 100000, feePct: 10 });

    const paid = await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${seededTenant.tenantId}/payouts/${created.body.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'paid' });
    expect(paid.body.status).toBe('paid');

    const list = await request(app.getHttpServer())
      .get('/v1/admin/payouts')
      .query({ pageSize: 100 })
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(list.body.items.some((p: { id: string }) => p.id === created.body.id)).toBe(true);
  });
});
