import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import { cleanupTenantWithUser } from '../utils/seed-auth-fixtures';
import { BookingFixture, addMinutesIso, seedBookingFixture } from '../utils/seed-booking-fixtures';

describe('Reativação de profissional reverte needs_reschedule (/v1/professionals/:id)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let fx: BookingFixture;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);
    fx = await seedBookingFixture(app, prisma, tenantContext, { slugPrefix: 'reactivate-prof' });
  });

  afterAll(async () => {
    await cleanupTenantWithUser(prisma, tenantContext, fx.admin.tenantId);
    await app.close();
  });

  async function book(startsAtIso: string) {
    const res = await request(app.getHttpServer())
      .post('/v1/appointments')
      .set('Authorization', `Bearer ${fx.clienteToken}`)
      .send({ serviceId: fx.serviceId, professionalId: fx.professionalId, startsAt: startsAtIso });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function statusOf(appointmentId: string) {
    const res = await request(app.getHttpServer())
      .get(`/v1/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${fx.adminToken}`);
    return res.body.status as string;
  }

  it('inativar manda pra needs_reschedule, reativar devolve tudo pra scheduled', async () => {
    const slotA = await book(fx.testSlotIso);
    const slotB = await book(addMinutesIso(fx.testSlotIso, 120));

    const deactivate = await request(app.getHttpServer())
      .patch(`/v1/professionals/${fx.professionalId}`)
      .set('Authorization', `Bearer ${fx.adminToken}`)
      .send({ active: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.affectedAppointmentsCount).toBe(2);
    expect(await statusOf(slotA)).toBe('needs_reschedule');
    expect(await statusOf(slotB)).toBe('needs_reschedule');

    const reactivate = await request(app.getHttpServer())
      .patch(`/v1/professionals/${fx.professionalId}`)
      .set('Authorization', `Bearer ${fx.adminToken}`)
      .send({ active: true });
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.revertedAppointmentsCount).toBe(2);
    expect(await statusOf(slotA)).toBe('scheduled');
    expect(await statusOf(slotB)).toBe('scheduled');
  });

  it('pula o horário que outro agendamento ocupou nesse meio-tempo, reverte só o resto', async () => {
    // Profissional próprio pra esse teste — não reaproveita o da primeira
    // `it`, senão os agendamentos já revertidos lá (ainda futuros e
    // `scheduled`) entrariam de novo na contagem de inativação daqui.
    const profRes = await request(app.getHttpServer())
      .post('/v1/professionals')
      .set('Authorization', `Bearer ${fx.adminToken}`)
      .send({ name: 'Barbeiro Conflito', email: `conflito-${Date.now()}@test.local`, password: 'senha-forte-123' });
    const professionalId = profRes.body.id as string;
    await request(app.getHttpServer())
      .post(`/v1/professionals/${professionalId}/services`)
      .set('Authorization', `Bearer ${fx.adminToken}`)
      .send({ serviceId: fx.serviceId });
    for (let d = 0; d <= 6; d++) {
      await request(app.getHttpServer())
        .post(`/v1/professionals/${professionalId}/working-hours`)
        .set('Authorization', `Bearer ${fx.adminToken}`)
        .send({ weekday: d, startTime: '00:00', endTime: '23:59' });
    }

    const bookWithProf = async (startsAtIso: string) => {
      const res = await request(app.getHttpServer())
        .post('/v1/appointments')
        .set('Authorization', `Bearer ${fx.clienteToken}`)
        .send({ serviceId: fx.serviceId, professionalId, startsAt: startsAtIso });
      expect(res.status).toBe(201);
      return res.body.id as string;
    };

    const slotCStartsAt = addMinutesIso(fx.testSlotIso, 300);
    const slotC = await bookWithProf(slotCStartsAt);
    const slotD = await bookWithProf(addMinutesIso(fx.testSlotIso, 420));

    const deactivate = await request(app.getHttpServer())
      .patch(`/v1/professionals/${professionalId}`)
      .set('Authorization', `Bearer ${fx.adminToken}`)
      .send({ active: false });
    expect(deactivate.body.affectedAppointmentsCount).toBe(2);

    // Simula outro agendamento ocupando o horário exato de slotC enquanto o
    // profissional estava inativo (via Prisma direto — a API em si rejeita
    // criar agendamento pra profissional inativo, mas o cenário de conflito
    // pode nascer por outro caminho; o que importa aqui é o comportamento
    // da reativação diante de um conflito já existente no banco).
    await tenantContext.runInTenantContext(fx.admin.tenantId, (tx) =>
      tx.appointment.create({
        data: {
          tenantId: fx.admin.tenantId,
          clientId: fx.clienteId,
          professionalId,
          serviceId: fx.serviceId,
          startsAt: new Date(slotCStartsAt),
          endsAt: new Date(new Date(slotCStartsAt).getTime() + fx.durationMinutes * 60_000),
          status: 'scheduled',
        },
      }),
    );

    const reactivate = await request(app.getHttpServer())
      .patch(`/v1/professionals/${professionalId}`)
      .set('Authorization', `Bearer ${fx.adminToken}`)
      .send({ active: true });
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.revertedAppointmentsCount).toBe(1);
    expect(await statusOf(slotC)).toBe('needs_reschedule');
    expect(await statusOf(slotD)).toBe('scheduled');
  });
});
