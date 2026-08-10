import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { cleanupTenantWithUser } from '../utils/seed-auth-fixtures';
import { BookingFixture, seedBookingFixture } from '../utils/seed-booking-fixtures';

describe('GET /v1/professionals/:id/availability', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let fx: BookingFixture;
  let dateStr: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);
    fx = await seedBookingFixture(app, prisma, tenantContext, { slugPrefix: 'avail', durationMinutes: 30 });
    dateStr = fx.testSlotIso.slice(0, 10);
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, fx.admin.tenantId);
    await app.close();
  });

  it('retorna slots de 30 em 30 min dentro do expediente configurado (00:00-23:59)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/professionals/${fx.professionalId}/availability`)
      .query({ serviceId: fx.serviceId, date: dateStr })
      .set('Authorization', `Bearer ${fx.clienteToken}`);

    expect(res.status).toBe(200);
    expect(res.body.slots.length).toBeGreaterThan(0);
    expect(res.body.slots).toContain(fx.testSlotIso);
  });

  it('slot ocupado por um agendamento não aparece mais na disponibilidade', async () => {
    await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fx.clienteToken}`)
      .send({ serviceId: fx.serviceId, professionalId: fx.professionalId, startsAt: fx.testSlotIso });

    const res = await request(app.getHttpServer())
      .get(`/v1/professionals/${fx.professionalId}/availability`)
      .query({ serviceId: fx.serviceId, date: dateStr })
      .set('Authorization', `Bearer ${fx.clienteToken}`);

    expect(res.body.slots).not.toContain(fx.testSlotIso);
  });

  it('todos os slots retornados estão no futuro', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/professionals/${fx.professionalId}/availability`)
      .query({ serviceId: fx.serviceId, date: dateStr })
      .set('Authorization', `Bearer ${fx.clienteToken}`);

    const now = Date.now();
    expect(res.body.slots.every((slot: string) => new Date(slot).getTime() >= now)).toBe(true);
  });

  it('404 se o profissional não realiza o serviço informado', async () => {
    const otherServiceRes = await request(app.getHttpServer())
      .post('/v1/services')
      .set('Authorization', `Bearer ${fx.adminToken}`)
      .send({ name: 'Serviço não associado', priceCents: 1000, durationMinutes: 15 });

    const res = await request(app.getHttpServer())
      .get(`/v1/professionals/${fx.professionalId}/availability`)
      .query({ serviceId: otherServiceRes.body.id, date: dateStr })
      .set('Authorization', `Bearer ${fx.clienteToken}`);

    expect(res.status).toBe(400);
  });

  it('400 para date em formato inválido', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/professionals/${fx.professionalId}/availability`)
      .query({ serviceId: fx.serviceId, date: '11-06-2026' })
      .set('Authorization', `Bearer ${fx.clienteToken}`);

    expect(res.status).toBe(400);
  });
});
