import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { SeededTenantUser, cleanupTenantWithUser, seedTenantWithUser } from '../utils/seed-auth-fixtures';

describe('7.2 — IDOR via URL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantA: SeededTenantUser;
  let tenantB: SeededTenantUser;
  let accessTokenA: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    tenantA = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'idor-a', role: 'admin' });
    tenantB = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'idor-b', role: 'admin' });

    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: tenantA.tenantSlug,
      email: tenantA.email,
      password: tenantA.password,
    });
    accessTokenA = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, tenantA.tenantId);
    await cleanupTenantWithUser(prisma, tenantContext, tenantB.tenantId);
    await app.close();
  });

  it('GET /v1/users/{id-do-tenant-B} autenticado como tenant A -> 404, nunca vaza o dado', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/users/${tenantB.userId}`)
      .set('Authorization', `Bearer ${accessTokenA}`);

    expect(res.status).toBe(404);
  });

  it('GET /v1/users/{id-do-próprio-tenant} continua funcionando normalmente', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/users/${tenantA.userId}`)
      .set('Authorization', `Bearer ${accessTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(tenantA.userId);
  });
});
