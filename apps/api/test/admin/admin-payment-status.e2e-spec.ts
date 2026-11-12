import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { nowInBarbershopTime } from '../../src/common/time.util';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { createTestApp } from '../utils/create-test-app';
import {
  SeededTenantUser,
  cleanupSuperAdmin,
  cleanupTenantWithUser,
  seedSuperAdmin,
  seedTenantWithUser,
} from '../utils/seed-auth-fixtures';

const currentPeriod = () => {
  const now = nowInBarbershopTime();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const SIX_MONTHS_AGO = new Date(nowInBarbershopTime());
SIX_MONTHS_AGO.setUTCMonth(SIX_MONTHS_AGO.getUTCMonth() - 6);

describe('Status de cobrança por barbearia (GET /v1/admin/tenants e /v1/admin/dashboard/overview)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let superAdmin: { userId: string; email: string; password: string };
  let superAdminToken: string;
  let proPlanId: string;
  let trialPlanId: string;
  let createdTrialPlan = false;

  let fxAtraso: SeededTenantUser;
  let fxEmDia: SeededTenantUser;
  let fxTrial: SeededTenantUser;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);

    superAdmin = await seedSuperAdmin(prisma);
    superAdminToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: superAdmin.email, password: superAdmin.password })
    ).body.accessToken;

    const proPlan = await prisma.plan.create({
      data: { code: `p${Date.now()}`.slice(0, 20), name: 'Pro teste status', priceCents: 14900 },
    });
    proPlanId = proPlan.id;

    // 'trial' é o código fixo que a regra de negócio reconhece como "sem
    // cobrança" (admin-payment-status.service.ts) — reaproveita o plano real
    // do catálogo se já existir (não cria duplicata, não apaga depois: é dado
    // de plataforma, não fixture deste teste).
    let trialPlan = await prisma.plan.findUnique({ where: { code: 'trial' } });
    if (!trialPlan) {
      trialPlan = await prisma.plan.create({ data: { code: 'trial', name: 'Trial', priceCents: 0 } });
      createdTrialPlan = true;
    }
    trialPlanId = trialPlan.id;

    // paymentDueDay=1 garante "já passou o vencimento" em qualquer dia do mês em
    // que o teste rodar — createdAt bem no passado garante que o 1º ciclo já
    // passou há muito tempo, independente de quando o teste roda.
    fxAtraso = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'pgto-atraso', role: 'admin' });
    await prisma.tenant.update({
      where: { id: fxAtraso.tenantId },
      data: { paymentDueDay: 1, createdAt: SIX_MONTHS_AGO },
    });
    await tenantContext.runInTenantContext(fxAtraso.tenantId, (tx) =>
      tx.subscription.create({ data: { tenantId: fxAtraso.tenantId, planId: proPlanId, status: 'active' } }),
    );

    fxEmDia = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'pgto-em-dia', role: 'admin' });
    await prisma.tenant.update({
      where: { id: fxEmDia.tenantId },
      data: { paymentDueDay: 1, createdAt: SIX_MONTHS_AGO },
    });
    await tenantContext.runInTenantContext(fxEmDia.tenantId, async (tx) => {
      await tx.subscription.create({ data: { tenantId: fxEmDia.tenantId, planId: proPlanId, status: 'active' } });
      await tx.payment.create({
        data: {
          tenantId: fxEmDia.tenantId,
          amountCents: 14900,
          period: currentPeriod(),
          status: 'paid',
          paidAt: new Date(),
        },
      });
    });

    fxTrial = await seedTenantWithUser(prisma, tenantContext, { slugPrefix: 'pgto-trial', role: 'admin' });
    await prisma.tenant.update({
      where: { id: fxTrial.tenantId },
      data: { paymentDueDay: 1, createdAt: SIX_MONTHS_AGO },
    });
    await tenantContext.runInTenantContext(fxTrial.tenantId, (tx) =>
      tx.subscription.create({ data: { tenantId: fxTrial.tenantId, planId: trialPlanId, status: 'active' } }),
    );
  });

  afterAll(async () => {
    for (const fx of [fxAtraso, fxEmDia, fxTrial]) {
      await tenantContext
        .runInTenantContext(fx.tenantId, (tx) => tx.payment.deleteMany({ where: { tenantId: fx.tenantId } }))
        .catch(() => {});
      await cleanupTenantWithUser(prisma, tenantContext, fx.tenantId).catch(() => {});
    }
    await prisma.subscription.deleteMany({ where: { planId: proPlanId } }).catch(() => {});
    await prisma.plan.delete({ where: { id: proPlanId } }).catch(() => {});
    if (createdTrialPlan) await prisma.plan.delete({ where: { id: trialPlanId } }).catch(() => {});
    await cleanupSuperAdmin(prisma, superAdmin.userId);
    await app.close();
  });

  it('traz o paymentStatus correto no detalhe de cada barbearia, sem vazar status de uma pra outra', async () => {
    const getStatus = async (tenantId: string) =>
      (
        await request(app.getHttpServer())
          .get(`/v1/admin/tenants/${tenantId}`)
          .set('Authorization', `Bearer ${superAdminToken}`)
      ).body.paymentStatus;

    expect(await getStatus(fxAtraso.tenantId)).toBe('em_atraso');
    expect(await getStatus(fxEmDia.tenantId)).toBe('em_dia');
    expect(await getStatus(fxTrial.tenantId)).toBe('sem_cobranca');
  });

  it('a listagem paginada também carrega um paymentStatus válido por linha', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/tenants')
      .query({ pageSize: 5 })
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(['em_dia', 'em_atraso', 'sem_cobranca']).toContain(item.paymentStatus);
    }
  });

  it('conta os 3 status no dashboard overview', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/dashboard/overview')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatusCounts.emAtraso).toBeGreaterThanOrEqual(1);
    expect(res.body.paymentStatusCounts.emDia).toBeGreaterThanOrEqual(1);
    expect(res.body.paymentStatusCounts.semCobranca).toBeGreaterThanOrEqual(1);
  });

  it('marcar o pagamento em atraso como pago vira em_dia (invalida o cache de 90s)', async () => {
    const pagamento = await tenantContext.runInTenantContext(fxAtraso.tenantId, (tx) =>
      tx.payment.create({
        data: { tenantId: fxAtraso.tenantId, amountCents: 14900, period: currentPeriod(), status: 'pending' },
      }),
    );

    const patch = await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${fxAtraso.tenantId}/payments/${pagamento.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'paid' });
    expect(patch.status).toBe(200);

    const res = await request(app.getHttpServer())
      .get(`/v1/admin/tenants/${fxAtraso.tenantId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.body.paymentStatus).toBe('em_dia');
  });
});
