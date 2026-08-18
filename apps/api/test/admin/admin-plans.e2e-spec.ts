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

describe('Catálogo de planos do Super Admin (/v1/admin/plans)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let superAdmin: { userId: string; email: string; password: string };
  let superAdminToken: string;
  let regularAdminToken: string;
  let seededTenant: SeededTenantUser;
  const createdPlanIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    superAdmin = await seedSuperAdmin(prisma);
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: superAdmin.email, password: superAdmin.password });
    superAdminToken = loginRes.body.accessToken;

    seededTenant = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'plans-admin', role: 'admin' });
    const adminLogin = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: seededTenant.tenantSlug,
      email: seededTenant.email,
      password: seededTenant.password,
    });
    regularAdminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    for (const id of createdPlanIds) {
      await prisma.plan.delete({ where: { id } }).catch(() => {});
    }
    await cleanupTenantWithUser(prisma, tenantContext, seededTenant.tenantId).catch(() => {});
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('admin de barbearia não pode criar plano', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/admin/plans')
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .send({ code: 'pro', name: 'Pro' });
    expect(res.status).toBe(403);
  });

  it('rejeita code fora de trial|pro|enterprise', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/admin/plans')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ code: 'starter', name: 'Starter' });
    expect(res.status).toBe(400);
  });

  it('cria um plano com módulos e preço, lista, edita e rejeita code duplicado', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/admin/plans')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ code: 'pro', name: 'Pro', priceCents: 29900, limitLabel: 'até 10 barbeiros', modules: ['Comissões', 'Assinaturas'] });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: 'pro', name: 'Pro', priceCents: 29900, modules: ['Comissões', 'Assinaturas'] });
    createdPlanIds.push(created.body.id);

    const dup = await request(app.getHttpServer())
      .post('/v1/admin/plans')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ code: 'pro', name: 'Pro de novo' });
    expect(dup.status).toBe(409);

    const list = await request(app.getHttpServer())
      .get('/v1/admin/plans')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((p: { id: string }) => p.id === created.body.id)).toBe(true);

    const updated = await request(app.getHttpServer())
      .patch(`/v1/admin/plans/${created.body.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ priceCents: 34900, active: false });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ priceCents: 34900, active: false, code: 'pro' });
  });

  it('plano Enterprise pode ficar sem preço (negociado) e depois ser limpo de volta pra null', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/admin/plans')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ code: 'enterprise', name: 'Enterprise', limitLabel: 'ilimitado' });
    expect(created.status).toBe(201);
    expect(created.body.priceCents).toBeNull();
    createdPlanIds.push(created.body.id);

    const withPrice = await request(app.getHttpServer())
      .patch(`/v1/admin/plans/${created.body.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ priceCents: 500000 });
    expect(withPrice.body.priceCents).toBe(500000);

    const backToNull = await request(app.getHttpServer())
      .patch(`/v1/admin/plans/${created.body.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ priceCents: null });
    expect(backToNull.body.priceCents).toBeNull();
  });
});
