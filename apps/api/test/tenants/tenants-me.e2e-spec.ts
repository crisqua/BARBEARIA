import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { SeededTenantUser, cleanupTenantWithUser, seedTenantWithUser } from '../utils/seed-auth-fixtures';

describe('/v1/tenants/me — self-service do Admin da barbearia', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let admin: SeededTenantUser;
  let cliente: SeededTenantUser;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    admin = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'tenant-me', role: 'admin' });
    cliente = await seedTenantWithUser(prisma, tenantContext, {
      slugPrefix: 'tenant-me-cliente',
      role: 'cliente',
    });

    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: admin.tenantSlug,
      email: admin.email,
      password: admin.password,
    });
    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, admin.tenantId);
    await cleanupTenantWithUser(prisma, tenantContext, cliente.tenantId);
    await app.close();
  });

  it('GET /v1/tenants/me retorna o próprio tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/tenants/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(admin.tenantId);
  });

  it('PATCH /v1/tenants/me atualiza a própria marca', async () => {
    const res = await request(app.getHttpServer())
      .patch('/v1/tenants/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Novo Nome', primaryColor: '#123456' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Novo Nome', primaryColor: '#123456' });
  });

  it('PATCH com campo status é rejeitado (400) — só Super Admin muda status', async () => {
    const res = await request(app.getHttpServer())
      .patch('/v1/tenants/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended' });

    expect(res.status).toBe(400);
  });

  it('cliente (não admin) não acessa /v1/tenants/me', async () => {
    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: cliente.tenantSlug,
      email: cliente.email,
      password: cliente.password,
    });

    const res = await request(app.getHttpServer())
      .get('/v1/tenants/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('sem token, 401', async () => {
    const res = await request(app.getHttpServer()).get('/v1/tenants/me');
    expect(res.status).toBe(401);
  });
});
