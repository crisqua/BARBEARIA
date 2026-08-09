import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { SeededTenantUser, cleanupTenantWithUser, seedTenantWithUser } from '../utils/seed-auth-fixtures';

describe('POST /v1/auth/refresh', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantUser: SeededTenantUser;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    tenantUser = await seedTenantWithUser(prisma, tenantContext, {
      slugPrefix: 'refresh-test',
      role: 'admin',
    });
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, tenantUser.tenantId);
    await app.close();
  });

  it('emite um novo accessToken usando o cookie de refresh do login', async () => {
    const agent = request.agent(app.getHttpServer());

    const loginRes = await agent.post('/v1/auth/login').send({
      tenantSlug: tenantUser.tenantSlug,
      email: tenantUser.email,
      password: tenantUser.password,
    });
    expect(loginRes.status).toBe(200);

    const refreshRes = await agent.post('/v1/auth/refresh').send();

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toEqual(expect.any(String));

    // Não comparamos com o token do login: JWT tem iat em resolução de segundo,
    // então dois tokens emitidos com o mesmo payload no mesmo segundo são
    // byte-a-byte idênticos — isso é esperado, não um bug. O que importa é que
    // o novo access token realmente funciona numa rota protegida.
    const meRes = await agent
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${refreshRes.body.accessToken}`);
    expect(meRes.status).toBe(200);
  });

  it('rejeita refresh sem cookie', async () => {
    const res = await request(app.getHttpServer()).post('/v1/auth/refresh').send();
    expect(res.status).toBe(401);
  });
});
