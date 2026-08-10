import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { cleanupTenantWithUser, seedUserInTenant } from '../utils/seed-auth-fixtures';
import { BookingFixture, seedBookingFixture } from '../utils/seed-booking-fixtures';

describe('7.8 (via API real) — concorrência no agendamento', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let fx: BookingFixture;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);
    fx = await seedBookingFixture(app, prisma, tenantContext, { slugPrefix: 'concurrency' });
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, fx.admin.tenantId);
    await app.close();
  });

  it('duas requisições simultâneas para o mesmo profissional/horário: só uma é aceita', async () => {
    const secondCliente = await seedUserInTenant(prisma, tenantContext, fx.admin.tenantId, 'cliente');
    const secondLogin = await request(app.getHttpServer()).post('/v1/auth/login').send({
      tenantSlug: fx.admin.tenantSlug,
      email: secondCliente.email,
      password: secondCliente.password,
    });
    const secondToken = secondLogin.body.accessToken;

    const attempt = (token: string) =>
      request(app.getHttpServer())
        .post('/v1/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceId: fx.serviceId, professionalId: fx.professionalId, startsAt: fx.testSlotIso });

    const [resA, resB] = await Promise.all([attempt(fx.clienteToken), attempt(secondToken)]);
    const statuses = [resA.status, resB.status].sort();

    expect(statuses).toEqual([201, 409]);
  });
});
