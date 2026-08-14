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

describe('CRUD de professionals (/v1/professionals)', () => {
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

    admin = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'prof-admin', role: 'admin' });
    // cliente no MESMO tenant do admin — precisa ver o profissional que o admin criar.
    cliente = await seedUserInTenant(prisma, tenantContext, admin.tenantId, 'cliente');
    otherTenantAdmin = await seedTenantWithUser(prisma, tenantContext, {
      slugPrefix: 'prof-other',
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

  let professionalId: string;
  const professionalEmail = `barbeiro-${Date.now()}@test.local`;

  it('admin cria um profissional, que consegue logar', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/professionals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Barbeiro Um', email: professionalEmail, password: 'senha-forte-123' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ role: 'barbeiro', email: professionalEmail });
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.commissionPercentage).toBeNull();
    professionalId = res.body.id;

    const login = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: admin.tenantSlug,
      email: professionalEmail,
      password: 'senha-forte-123',
    });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('barbeiro');
  });

  it('rejeita e-mail duplicado', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/professionals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicado', email: professionalEmail, password: 'senha-forte-123' });

    expect(res.status).toBe(409);
  });

  it('cliente não pode criar profissional', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/professionals')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({ name: 'X', email: `x-${Date.now()}@test.local`, password: 'senha-forte-123' });

    expect(res.status).toBe(403);
  });

  it('lista e busca o profissional', async () => {
    const list = await request(app.getHttpServer())
      .get('/v1/professionals')
      .set('Authorization', `Bearer ${clienteToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((p: { id: string }) => p.id === professionalId)).toBe(true);

    const one = await request(app.getHttpServer())
      .get(`/v1/professionals/${professionalId}`)
      .set('Authorization', `Bearer ${clienteToken}`);
    expect(one.status).toBe(200);
  });

  it('admin atualiza nome/telefone do profissional', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/professionals/${professionalId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Barbeiro Atualizado', phone: '11999998888' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Barbeiro Atualizado');
  });

  it('admin cria profissional já com % de comissão', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/professionals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Barbeiro Comissionado',
        email: `comissao-${Date.now()}@test.local`,
        password: 'senha-forte-123',
        commissionPercentage: 12.5,
      });

    expect(res.status).toBe(201);
    expect(res.body.commissionPercentage).toBe(12.5);
  });

  it('admin atualiza o % de comissão do profissional', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/professionals/${professionalId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionPercentage: 20 });

    expect(res.status).toBe(200);
    expect(res.body.commissionPercentage).toBe(20);
  });

  it('rejeita % de comissão fora do intervalo 0-100', async () => {
    const tooHigh = await request(app.getHttpServer())
      .patch(`/v1/professionals/${professionalId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionPercentage: 150 });
    expect(tooHigh.status).toBe(400);

    const negative = await request(app.getHttpServer())
      .patch(`/v1/professionals/${professionalId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionPercentage: -5 });
    expect(negative.status).toBe(400);

    const tooManyDecimals = await request(app.getHttpServer())
      .patch(`/v1/professionals/${professionalId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionPercentage: 12.555 });
    expect(tooManyDecimals.status).toBe(400);
  });

  it('admin de outro tenant não vê o profissional (RLS)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/professionals/${professionalId}`)
      .set('Authorization', `Bearer ${otherTenantAdminToken}`);

    expect(res.status).toBe(404);
  });
});
