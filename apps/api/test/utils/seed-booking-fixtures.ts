import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { SeededTenantUser, seedTenantWithUser } from './seed-auth-fixtures';

export interface BookingFixture {
  admin: SeededTenantUser;
  adminToken: string;
  clienteEmail: string;
  clientePassword: string;
  clienteToken: string;
  clienteId: string;
  professionalId: string;
  professionalEmail: string;
  professionalPassword: string;
  professionalToken: string;
  serviceId: string;
  durationMinutes: number;
  weekday: number;
  /** ISO datetime bem no futuro, dentro do expediente configurado (00:00-23:59 no weekday acima). */
  testSlotIso: string;
}

/** >=24h no futuro — nunca cai no passado nem gera ambiguidade perto da meia-noite. */
export function futureSlot(hoursFromNow = 26): Date {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60_000);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export async function seedBookingFixture(
  app: INestApplication,
  prisma: PrismaService,
  tenantContext: TenantContextService,
  opts: { slugPrefix: string; durationMinutes?: number },
): Promise<BookingFixture> {
  const admin = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: opts.slugPrefix, role: 'admin' });

  const adminToken = (
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ tenantSlug: admin.tenantSlug, email: admin.email, password: admin.password })
  ).body.accessToken;

  const clienteEmail = `${opts.slugPrefix}-cliente-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`;
  const clientePassword = 'senha-forte-123';
  await request(app.getHttpServer()).post('/v1/auth/register').send({
    tenantSlug: admin.tenantSlug,
    name: 'Cliente Fixture',
    email: clienteEmail,
    password: clientePassword,
  });
  const clienteLogin = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ tenantSlug: admin.tenantSlug, email: clienteEmail, password: clientePassword });
  const clienteToken = clienteLogin.body.accessToken;
  const clienteId = clienteLogin.body.user.id;

  const durationMinutes = opts.durationMinutes ?? 30;
  const serviceRes = await request(app.getHttpServer())
    .post('/v1/services')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Corte Fixture', priceCents: 5000, durationMinutes });
  const serviceId = serviceRes.body.id;

  const professionalEmail = `${opts.slugPrefix}-barbeiro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`;
  const professionalPassword = 'senha-forte-123';
  const profRes = await request(app.getHttpServer())
    .post('/v1/professionals')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Barbeiro Fixture', email: professionalEmail, password: professionalPassword });
  const professionalId = profRes.body.id;

  const professionalToken = (
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ tenantSlug: admin.tenantSlug, email: professionalEmail, password: professionalPassword })
  ).body.accessToken;

  await request(app.getHttpServer())
    .post(`/v1/professionals/${professionalId}/services`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ serviceId });

  const testSlot = futureSlot();
  const weekday = testSlot.getUTCDay();
  // Todos os 7 dias abertos — evita que aritmética de offset em minutos (usada
  // pelos testes pra gerar slots distintos) caia acidentalmente num dia sem
  // expediente configurado, dependendo da hora em que a suíte é executada.
  for (let d = 0; d <= 6; d++) {
    await request(app.getHttpServer())
      .post(`/v1/professionals/${professionalId}/working-hours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weekday: d, startTime: '00:00', endTime: '23:59' });
  }

  return {
    admin,
    adminToken,
    clienteEmail,
    clientePassword,
    clienteToken,
    clienteId,
    professionalId,
    professionalEmail,
    professionalPassword,
    professionalToken,
    serviceId,
    durationMinutes,
    weekday,
    testSlotIso: testSlot.toISOString(),
  };
}
