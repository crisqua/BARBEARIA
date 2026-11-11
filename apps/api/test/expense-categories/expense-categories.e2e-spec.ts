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

describe('Categorias de despesa por tenant (/v1/expense-categories)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let admin: SeededTenantUser;
  let barbeiro: SeededUser;
  let otherTenantAdmin: SeededTenantUser;
  let adminToken: string;
  let barbeiroToken: string;
  let otherTenantAdminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    admin = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'expcat-admin', role: 'admin' });
    barbeiro = await seedUserInTenant(prisma, tenantContext, admin.tenantId, 'barbeiro');
    otherTenantAdmin = await seedTenantWithUser(prisma, tenantContext, {
      slugPrefix: 'expcat-other',
      role: 'admin',
    });

    const login = (tenantSlug: string, email: string, password: string) =>
      request(app.getHttpServer()).post('/v1/auth/login').send({ tenantSlug, email, password }).then((r) => r.body.accessToken);

    adminToken = await login(admin.tenantSlug, admin.email, admin.password);
    barbeiroToken = await login(admin.tenantSlug, barbeiro.email, barbeiro.password);
    otherTenantAdminToken = await login(otherTenantAdmin.tenantSlug, otherTenantAdmin.email, otherTenantAdmin.password);
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, admin.tenantId);
    await cleanupTenantWithUser(prisma, tenantContext, otherTenantAdmin.tenantId);
    await app.close();
  });

  it('admin cria uma categoria nova', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/expense-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Manutenção de Equipamentos' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Manutenção de Equipamentos' });
  });

  it('rejeita categoria duplicada no mesmo tenant (409)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/expense-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Manutenção de Equipamentos' });

    expect(res.status).toBe(409);
  });

  it('barbeiro não pode criar nem listar categorias', async () => {
    const create = await request(app.getHttpServer())
      .post('/v1/expense-categories')
      .set('Authorization', `Bearer ${barbeiroToken}`)
      .send({ name: 'Outra' });
    expect(create.status).toBe(403);

    const list = await request(app.getHttpServer())
      .get('/v1/expense-categories')
      .set('Authorization', `Bearer ${barbeiroToken}`);
    expect(list.status).toBe(403);
  });

  it('admin lista só as categorias do próprio tenant (isolamento)', async () => {
    const list = await request(app.getHttpServer())
      .get('/v1/expense-categories')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.some((c: { name: string }) => c.name === 'Manutenção de Equipamentos')).toBe(true);

    const otherList = await request(app.getHttpServer())
      .get('/v1/expense-categories')
      .set('Authorization', `Bearer ${otherTenantAdminToken}`);
    expect(otherList.status).toBe(200);
    expect(otherList.body.some((c: { name: string }) => c.name === 'Manutenção de Equipamentos')).toBe(false);
  });

  it('a categoria customizada pode ser usada numa despesa (categoria é texto livre)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        category: 'Manutenção de Equipamentos',
        description: 'Troca de lâmina da máquina',
        amountCents: 5000,
        paymentMethod: 'pix',
        expenseDate: '2026-11-11',
      });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe('Manutenção de Equipamentos');
  });
});
