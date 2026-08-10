import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { SeededTenantUser, cleanupTenantWithUser, seedTenantWithUser } from '../utils/seed-auth-fixtures';

describe('Associação profissional <-> serviço (/v1/professionals/:id/services)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let admin: SeededTenantUser;
  let otherTenant: SeededTenantUser;
  let adminToken: string;
  let professionalId: string;
  let clienteId: string;
  let clienteEmail: string;
  let serviceId: string;
  let otherTenantServiceId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    admin = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'ps-admin', role: 'admin' });
    otherTenant = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'ps-other', role: 'admin' });

    adminToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ tenantSlug: admin.tenantSlug, email: admin.email, password: admin.password })
    ).body.accessToken;

    const otherTenantAdminToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ tenantSlug: otherTenant.tenantSlug, email: otherTenant.email, password: otherTenant.password })
    ).body.accessToken;

    const profRes = await request(app.getHttpServer())
      .post('/v1/professionals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Barbeiro PS', email: `ps-barbeiro-${Date.now()}@test.local`, password: 'senha-forte-123' });
    professionalId = profRes.body.id;

    const svcRes = await request(app.getHttpServer())
      .post('/v1/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Corte PS', priceCents: 4000, durationMinutes: 30 });
    serviceId = svcRes.body.id;

    const otherSvcRes = await request(app.getHttpServer())
      .post('/v1/services')
      .set('Authorization', `Bearer ${otherTenantAdminToken}`)
      .send({ name: 'Corte Outro Tenant', priceCents: 4000, durationMinutes: 30 });
    otherTenantServiceId = otherSvcRes.body.id;

    clienteEmail = `ps-cliente-${Date.now()}@test.local`;
    const clienteRes = await request(app.getHttpServer()).post('/v1/auth/register').send({
      tenantSlug: admin.tenantSlug,
      name: 'Cliente PS',
      email: clienteEmail,
      password: 'senha-forte-123',
    });
    clienteId = clienteRes.body.user.id;
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, admin.tenantId);
    await cleanupTenantWithUser(prisma, tenantContext, otherTenant.tenantId);
    await app.close();
  });

  it('admin associa um serviço ao profissional', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/professionals/${professionalId}/services`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ serviceId });

    expect(res.status).toBe(201);

    const list = await request(app.getHttpServer())
      .get(`/v1/professionals/${professionalId}/services`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.some((s: { id: string }) => s.id === serviceId)).toBe(true);
  });

  it('lookup reverso: GET /v1/services/:id/professionals mostra o profissional', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/services/${serviceId}/professionals`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.some((p: { id: string }) => p.id === professionalId)).toBe(true);
  });

  it('rejeita associação duplicada', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/professionals/${professionalId}/services`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ serviceId });

    expect(res.status).toBe(409);
  });

  it('rejeita associar serviço de OUTRO tenant (FK composta, seção 7.5)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/professionals/${professionalId}/services`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ serviceId: otherTenantServiceId });

    expect(res.status).toBe(404);
  });

  it('rejeita associar serviço a um usuário que não é barbeiro', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/professionals/${clienteId}/services`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ serviceId });

    expect(res.status).toBe(404);
  });

  it('cliente autenticado (não-admin) não pode associar', async () => {
    const clienteLogin = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: admin.tenantSlug,
      email: clienteEmail,
      password: 'senha-forte-123',
    });

    const res = await request(app.getHttpServer())
      .post(`/v1/professionals/${professionalId}/services`)
      .set('Authorization', `Bearer ${clienteLogin.body.accessToken}`)
      .send({ serviceId });
    expect(res.status).toBe(403);
  });

  it('sem token, 401', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/professionals/${professionalId}/services`)
      .send({ serviceId });
    expect(res.status).toBe(401);
  });

  it('admin desassocia o serviço', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/v1/professionals/${professionalId}/services/${serviceId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const list = await request(app.getHttpServer())
      .get(`/v1/professionals/${professionalId}/services`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.some((s: { id: string }) => s.id === serviceId)).toBe(false);
  });

  it('desassociar de novo dá 404', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/v1/professionals/${professionalId}/services/${serviceId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
