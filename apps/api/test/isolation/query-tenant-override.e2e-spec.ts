import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { SeededTenantUser, cleanupTenantWithUser, seedTenantWithUser } from '../utils/seed-auth-fixtures';

describe('7.4 — Manipulação de tenant_id via query string', () => {
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

    tenantA = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'query-a', role: 'admin' });
    tenantB = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'query-b', role: 'admin' });

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

  it('?tenantId=<tenantA> na URL não faz o tenant B ficar visível', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/users/${tenantB.userId}`)
      .query({ tenantId: tenantA.tenantId })
      .set('Authorization', `Bearer ${accessTokenA}`);

    expect(res.status).toBe(404);
  });

  it('?tenantId=<tenantB> na URL não muda o contexto — resposta continua sendo do tenant A (do JWT)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/users/${tenantA.userId}`)
      .query({ tenantId: tenantB.tenantId })
      .set('Authorization', `Bearer ${accessTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe(tenantA.tenantId);
  });
});
