import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import {
  cleanupSuperAdmin,
  cleanupTenantWithUser,
  seedSuperAdmin,
  seedTenantWithUser,
} from '../utils/seed-auth-fixtures';

const uniqueSlug = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Provisionamento de tenants (/v1/admin/tenants)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let superAdmin: { userId: string; email: string; password: string };
  let superAdminToken: string;
  const createdTenantIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    superAdmin = await seedSuperAdmin(prisma);
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: superAdmin.email, password: superAdmin.password });
    superAdminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    for (const tenantId of createdTenantIds) {
      await cleanupTenantWithUser(prisma, tenantContext, tenantId).catch(() => {});
    }
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('super_admin cria tenant + admin inicial numa única chamada, e o admin consegue logar', async () => {
    const slug = uniqueSlug('provision');
    const res = await request(app.getHttpServer())
      .post('/v1/admin/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        slug,
        name: 'Barbearia Provisionada',
        admin: { name: 'Admin Inicial', email: `admin-${slug}@test.local`, password: 'senha-forte-123' },
      });

    expect(res.status).toBe(201);
    expect(res.body.tenant).toMatchObject({ slug, name: 'Barbearia Provisionada' });
    expect(res.body.admin.email).toBe(`admin-${slug}@test.local`);
    createdTenantIds.push(res.body.tenant.id);

    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: slug,
      email: `admin-${slug}@test.local`,
      password: 'senha-forte-123',
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user).toMatchObject({ tenantId: res.body.tenant.id, role: 'admin' });
  });

  it('usuário comum (não super_admin) não pode provisionar tenant', async () => {
    const seeded = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'blocked', role: 'admin' });
    createdTenantIds.push(seeded.tenantId);

    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: seeded.tenantSlug,
      email: seeded.email,
      password: seeded.password,
    });

    const res = await request(app.getHttpServer())
      .post('/v1/admin/tenants')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({
        slug: uniqueSlug('blocked-attempt'),
        name: 'Não deveria existir',
        admin: { name: 'X', email: `x-${Date.now()}@test.local`, password: 'senha-forte-123' },
      });

    expect(res.status).toBe(403);
  });

  it('rejeita slug duplicado', async () => {
    const slug = uniqueSlug('dup');
    const payload = {
      slug,
      name: 'Original',
      admin: { name: 'Admin A', email: `a-${slug}@test.local`, password: 'senha-forte-123' },
    };

    const first = await request(app.getHttpServer())
      .post('/v1/admin/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send(payload);
    expect(first.status).toBe(201);
    createdTenantIds.push(first.body.tenant.id);

    const second = await request(app.getHttpServer())
      .post('/v1/admin/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ ...payload, admin: { ...payload.admin, email: `b-${slug}@test.local` } });

    expect(second.status).toBe(409);
  });

  it('lista tenants paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/tenants')
      .query({ page: 1, pageSize: 5 })
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 5 });
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('suspende um tenant e o login do admin dele para de funcionar', async () => {
    const slug = uniqueSlug('suspend');
    const created = await request(app.getHttpServer())
      .post('/v1/admin/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        slug,
        name: 'Barbearia a Suspender',
        admin: { name: 'Admin', email: `admin-${slug}@test.local`, password: 'senha-forte-123' },
      });
    createdTenantIds.push(created.body.tenant.id);

    const patchRes = await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${created.body.tenant.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'suspended' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.status).toBe('suspended');

    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: slug,
      email: `admin-${slug}@test.local`,
      password: 'senha-forte-123',
    });
    expect(loginRes.status).toBe(401);
  });
});
