import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { nowInBarbershopTime } from '../../src/common/time.util';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { cleanupTenantWithUser } from '../utils/seed-auth-fixtures';
import { BookingFixture, addMinutesIso, seedBookingFixture } from '../utils/seed-booking-fixtures';

describe('CRUD de appointments (/v1/appointments)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let fx: BookingFixture;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);
    fx = await seedBookingFixture(app, prisma, tenantContext, { slugPrefix: 'appt' });
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, fx.admin.tenantId);
    await app.close();
  });

  let appointmentId: string;

  it('cliente cria um agendamento', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fx.clienteToken}`)
      .send({ serviceId: fx.serviceId, professionalId: fx.professionalId, startsAt: fx.testSlotIso });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      clientId: fx.clienteId,
      professionalId: fx.professionalId,
      serviceId: fx.serviceId,
      status: 'scheduled',
    });
    appointmentId = res.body.id;
  });

  it('admin/barbeiro não podem criar agendamento (só cliente)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fx.adminToken}`)
      .send({
        serviceId: fx.serviceId,
        professionalId: fx.professionalId,
        startsAt: addMinutesIso(fx.testSlotIso, 120),
      });

    expect(res.status).toBe(403);
  });

  it('rejeita agendamento no passado', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fx.clienteToken}`)
      .send({
        serviceId: fx.serviceId,
        professionalId: fx.professionalId,
        startsAt: new Date(nowInBarbershopTime().getTime() - 60_000).toISOString(),
      });

    expect(res.status).toBe(400);
  });

  it('rejeita agendamento fora do expediente do profissional', async () => {
    // Profissional sem nenhum working_hours cadastrado -> nada cobre o horário,
    // não importa qual seja (mais robusto que depender de aritmética de weekday).
    const noHoursProf = await request(app.getHttpServer())
      .post('/v1/professionals')
      .set('Authorization', `Bearer ${fx.adminToken}`)
      .send({
        name: 'Sem Expediente',
        email: `no-hours-${Date.now()}@test.local`,
        password: 'senha-forte-123',
      });
    await request(app.getHttpServer())
      .post(`/v1/professionals/${noHoursProf.body.id}/services`)
      .set('Authorization', `Bearer ${fx.adminToken}`)
      .send({ serviceId: fx.serviceId });

    const res = await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fx.clienteToken}`)
      .send({
        serviceId: fx.serviceId,
        professionalId: noHoursProf.body.id,
        startsAt: addMinutesIso(fx.testSlotIso, 60),
      });

    expect(res.status).toBe(400);
  });

  it('rejeita agendamento com profissional que não realiza o serviço', async () => {
    const otherServiceRes = await request(app.getHttpServer())
      .post('/v1/services')
      .set('Authorization', `Bearer ${fx.adminToken}`)
      .send({ name: 'Serviço não associado', priceCents: 1000, durationMinutes: 15 });

    const res = await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fx.clienteToken}`)
      .send({
        serviceId: otherServiceRes.body.id,
        professionalId: fx.professionalId,
        startsAt: addMinutesIso(fx.testSlotIso, 300),
      });

    expect(res.status).toBe(400);
  });

  it('GET /v1/appointments/:id: dono vê, outro cliente não (404)', async () => {
    const own = await request(app.getHttpServer())
      .get(`/v1/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${fx.clienteToken}`);
    expect(own.status).toBe(200);

    const otherFx = await seedBookingFixture(app, prisma, tenantContext, { slugPrefix: 'appt-other-cliente' });
    const other = await request(app.getHttpServer())
      .get(`/v1/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${otherFx.clienteToken}`);
    expect(other.status).toBe(404);

    await cleanupTenantWithUser(prisma, tenantContext, otherFx.admin.tenantId);
  });

  it('admin vê todos os agendamentos do tenant; barbeiro vê só a própria agenda', async () => {
    const asAdmin = await request(app.getHttpServer())
      .get('/v1/appointments')
      .set('Authorization', `Bearer ${fx.adminToken}`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.items.some((a: { id: string }) => a.id === appointmentId)).toBe(true);

    const asBarbeiro = await request(app.getHttpServer())
      .get('/v1/appointments')
      .set('Authorization', `Bearer ${fx.professionalToken}`);
    expect(asBarbeiro.status).toBe(200);
    expect(
      asBarbeiro.body.items.every((a: { professionalId: string }) => a.professionalId === fx.professionalId),
    ).toBe(true);
    expect(asBarbeiro.body.items.some((a: { id: string }) => a.id === appointmentId)).toBe(true);
  });

  it('cliente cancela o próprio agendamento', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${fx.clienteToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('cancelar de novo dá 400 (já não está scheduled)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${fx.clienteToken}`);

    expect(res.status).toBe(400);
  });

  it('cliente reagenda um agendamento próprio para outro horário válido', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fx.clienteToken}`)
      .send({ serviceId: fx.serviceId, professionalId: fx.professionalId, startsAt: addMinutesIso(fx.testSlotIso, 600) });
    expect(created.status).toBe(201);

    const newSlot = addMinutesIso(fx.testSlotIso, 660);
    const res = await request(app.getHttpServer())
      .patch(`/v1/appointments/${created.body.id}/reschedule`)
      .set('Authorization', `Bearer ${fx.clienteToken}`)
      .send({ startsAt: newSlot });

    expect(res.status).toBe(200);
    expect(new Date(res.body.startsAt).toISOString()).toBe(newSlot);
  });

  it('reagendar para um horário já ocupado dá 409', async () => {
    const slotA = addMinutesIso(fx.testSlotIso, 900);
    const apptA = await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fx.clienteToken}`)
      .send({ serviceId: fx.serviceId, professionalId: fx.professionalId, startsAt: slotA });
    expect(apptA.status).toBe(201);

    const slotB = addMinutesIso(fx.testSlotIso, 960);
    const apptB = await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fx.clienteToken}`)
      .send({ serviceId: fx.serviceId, professionalId: fx.professionalId, startsAt: slotB });
    expect(apptB.status).toBe(201);

    const res = await request(app.getHttpServer())
      .patch(`/v1/appointments/${apptB.body.id}/reschedule`)
      .set('Authorization', `Bearer ${fx.clienteToken}`)
      .send({ startsAt: slotA });

    expect(res.status).toBe(409);
  });

  it('rejeita agendamento com profissional/serviço de outro tenant (FK composta, seção 7.6)', async () => {
    const otherFx = await seedBookingFixture(app, prisma, tenantContext, { slugPrefix: 'appt-cross-tenant' });

    const res = await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fx.clienteToken}`)
      .send({
        serviceId: otherFx.serviceId,
        professionalId: fx.professionalId,
        startsAt: addMinutesIso(fx.testSlotIso, 1200),
      });

    expect(res.status).toBe(404);

    await cleanupTenantWithUser(prisma, tenantContext, otherFx.admin.tenantId);
  });
});
