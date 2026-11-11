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

describe('CRUD de despesas (/v1/expenses)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let admin: SeededTenantUser;
  let cliente: SeededUser;
  let barbeiro: SeededUser;
  let otherTenantAdmin: SeededTenantUser;
  let adminToken: string;
  let clienteToken: string;
  let barbeiroToken: string;
  let otherTenantAdminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    admin = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'exp-admin', role: 'admin' });
    cliente = await seedUserInTenant(prisma, tenantContext, admin.tenantId, 'cliente');
    barbeiro = await seedUserInTenant(prisma, tenantContext, admin.tenantId, 'barbeiro');
    otherTenantAdmin = await seedTenantWithUser(prisma, tenantContext, {
      slugPrefix: 'exp-other',
      role: 'admin',
    });

    const login = (tenantSlug: string, email: string, password: string) =>
      request(app.getHttpServer()).post('/v1/auth/login').send({ tenantSlug, email, password }).then((r) => r.body.accessToken);

    adminToken = await login(admin.tenantSlug, admin.email, admin.password);
    clienteToken = await login(admin.tenantSlug, cliente.email, cliente.password);
    barbeiroToken = await login(admin.tenantSlug, barbeiro.email, barbeiro.password);
    otherTenantAdminToken = await login(otherTenantAdmin.tenantSlug, otherTenantAdmin.email, otherTenantAdmin.password);
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, admin.tenantId);
    await cleanupTenantWithUser(prisma, tenantContext, otherTenantAdmin.tenantId);
    await app.close();
  });

  let expenseId: string;

  it('admin cria uma despesa', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        category: 'insumos',
        description: 'Produtos de barbearia',
        amountCents: 30000,
        paymentMethod: 'pix',
        expenseDate: '2026-11-10',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ category: 'insumos', amountCents: 30000, paymentMethod: 'pix' });
    expenseId = res.body.id;
  });

  it('barbeiro e cliente não podem criar despesa', async () => {
    const payload = {
      category: 'outras',
      description: 'Teste',
      amountCents: 1000,
      paymentMethod: 'dinheiro',
      expenseDate: '2026-11-10',
    };

    const asBarbeiro = await request(app.getHttpServer())
      .post('/v1/expenses')
      .set('Authorization', `Bearer ${barbeiroToken}`)
      .send(payload);
    expect(asBarbeiro.status).toBe(403);

    const asCliente = await request(app.getHttpServer())
      .post('/v1/expenses')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send(payload);
    expect(asCliente.status).toBe(403);
  });

  it('barbeiro e cliente não podem listar despesas', async () => {
    const asBarbeiro = await request(app.getHttpServer())
      .get('/v1/expenses')
      .set('Authorization', `Bearer ${barbeiroToken}`);
    expect(asBarbeiro.status).toBe(403);

    const asCliente = await request(app.getHttpServer())
      .get('/v1/expenses')
      .set('Authorization', `Bearer ${clienteToken}`);
    expect(asCliente.status).toBe(403);
  });

  it('admin lista despesas e filtra por categoria', async () => {
    const all = await request(app.getHttpServer())
      .get('/v1/expenses')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(all.status).toBe(200);
    expect(all.body.items.some((e: { id: string }) => e.id === expenseId)).toBe(true);

    const filtered = await request(app.getHttpServer())
      .get('/v1/expenses?category=fixas')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.items.some((e: { id: string }) => e.id === expenseId)).toBe(false);
  });

  it('admin edita a despesa', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amountCents: 35000 });

    expect(res.status).toBe(200);
    expect(res.body.amountCents).toBe(35000);
  });

  it('admin de outro tenant não vê nem edita a despesa (RLS)', async () => {
    const edit = await request(app.getHttpServer())
      .patch(`/v1/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${otherTenantAdminToken}`)
      .send({ amountCents: 1 });
    expect(edit.status).toBe(404);

    const list = await request(app.getHttpServer())
      .get('/v1/expenses')
      .set('Authorization', `Bearer ${otherTenantAdminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((e: { id: string }) => e.id === expenseId)).toBe(false);
  });

  it('admin remove a despesa (hard delete)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/v1/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const list = await request(app.getHttpServer())
      .get('/v1/expenses')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.items.some((e: { id: string }) => e.id === expenseId)).toBe(false);
  });
});
