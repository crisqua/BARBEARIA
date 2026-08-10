import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import {
  SeededTenantUser,
  SeededUser,
  cleanupTenantWithUser,
  seedTenantWithUser,
  seedUserInTenant,
} from '../utils/seed-auth-fixtures';

describe('CRUD de services (/v1/services)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let admin: SeededTenantUser;
  let cliente: SeededUser;
  let otherTenantAdmin: SeededTenantUser;
  let adminToken: string;
  let clienteToken: string;
  let otherTenantAdminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    admin = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'svc-admin', role: 'admin' });
    // cliente no MESMO tenant do admin — precisa ver o serviço que o admin criar.
    cliente = await seedUserInTenant(prisma, tenantContext, admin.tenantId, 'cliente');
    otherTenantAdmin = await seedTenantWithUser(prisma, tenantContext, {
      slugPrefix: 'svc-other',
      role: 'admin',
    });

    adminToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ tenantSlug: admin.tenantSlug, email: admin.email, password: admin.password })
    ).body.accessToken;

    clienteToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ tenantSlug: admin.tenantSlug, email: cliente.email, password: cliente.password })
    ).body.accessToken;

    otherTenantAdminToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          tenantSlug: otherTenantAdmin.tenantSlug,
          email: otherTenantAdmin.email,
          password: otherTenantAdmin.password,
        })
    ).body.accessToken;
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, admin.tenantId);
    await cleanupTenantWithUser(prisma, tenantContext, otherTenantAdmin.tenantId);
    await app.close();
  });

  let serviceId: string;

  it('admin cria um serviço', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Corte Masculino', priceCents: 5000, durationMinutes: 30 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Corte Masculino', priceCents: 5000, active: true });
    serviceId = res.body.id;
  });

  it('cliente não pode criar serviço', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/services')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({ name: 'Barba', priceCents: 3000, durationMinutes: 20 });

    expect(res.status).toBe(403);
  });

  it('cliente consegue listar e ver o serviço (leitura aberta ao tenant)', async () => {
    const list = await request(app.getHttpServer())
      .get('/v1/services')
      .set('Authorization', `Bearer ${clienteToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((s: { id: string }) => s.id === serviceId)).toBe(true);

    const one = await request(app.getHttpServer())
      .get(`/v1/services/${serviceId}`)
      .set('Authorization', `Bearer ${clienteToken}`);
    expect(one.status).toBe(200);
    expect(one.body.id).toBe(serviceId);
  });

  it('admin desativa o serviço via PATCH active:false', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/services/${serviceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it('admin de outro tenant não vê o serviço (RLS)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/services/${serviceId}`)
      .set('Authorization', `Bearer ${otherTenantAdminToken}`);

    expect(res.status).toBe(404);
  });
});
