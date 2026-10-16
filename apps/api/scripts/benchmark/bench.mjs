// Benchmark de latência de todas as rotas da API Barberaria.
// Uso: node bench.mjs <BASE_URL> <N_TENANTS> <ITER> <out.json>
// Pré-requisitos: banco local na porta 55432 (DIRECT_URL abaixo), super_admin
// sa@bench.com / benchpass123 criado via `npm run seed:super-admin`. Cria massa de
// teste (tenants bench-*) — NÃO rodar contra banco de homologação/produção.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const N_TENANTS = Number(process.argv[3] ?? 50);
const ITER = Number(process.argv[4] ?? 10);
const OUT = process.argv[5] ?? 'results.json';
const DIRECT = 'postgresql://barberaria:barberaria@localhost:55432/barberaria';
const RUN = Date.now().toString(36);

const psql = (sql) => execFileSync('psql', [DIRECT, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql]).toString().trim();

async function call(method, path, { token, body, cookie } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (cookie) headers.cookie = cookie;
  const t0 = performance.now();
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  const ms = performance.now() - t0;
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ms, json, setCookie: res.headers.get('set-cookie') };
}
async function must(method, path, opts) {
  const r = await call(method, path, opts);
  if (r.status >= 400) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
}

const results = [];
// fn(i) devolve { method, path, opts } ou executa a chamada; mede só a chamada HTTP.
async function measure(route, desc, iters, mk) {
  const times = []; const statuses = new Set();
  for (let i = 0; i < iters; i++) {
    const { method, path, opts } = await mk(i);
    const r = await call(method, path, opts);
    times.push(r.ms); statuses.add(r.status);
  }
  times.sort((a, b) => a - b);
  const pick = (p) => times[Math.min(times.length - 1, Math.ceil(p * times.length) - 1)];
  const row = { route, desc, n: iters, p50: pick(0.5), p95: pick(0.95), max: times.at(-1), statuses: [...statuses] };
  results.push(row);
  console.log(`${route.padEnd(62)} p50=${row.p50.toFixed(0).padStart(5)}ms p95=${row.p95.toFixed(0).padStart(5)}ms max=${row.max.toFixed(0).padStart(5)}ms ${row.statuses}`);
}

// ─────────── SETUP ───────────
console.log(`Setup: ${N_TENANTS} tenants, base=${BASE}`);
const sa = (await must('POST', '/v1/auth/login', { body: { email: 'sa@bench.com', password: 'benchpass123' } })).accessToken;

let plans = (await must('GET', '/v1/admin/plans', { token: sa }));
plans = plans.items ?? plans;
let trial = plans.find((p) => p.code === 'trial');
let pro = plans.find((p) => p.code === 'pro');
if (!trial) trial = await must('POST', '/v1/admin/plans', { token: sa, body: { code: 'trial', name: 'Trial', priceCents: 0, modules: ['agenda'] } });
if (!pro) pro = await must('POST', '/v1/admin/plans', { token: sa, body: { code: 'pro', name: 'Pro', priceCents: 14900, modules: ['agenda'] } });

const existing = Number(psql(`select count(*) from tenants`));
for (let i = existing; i < N_TENANTS; i++) {
  await must('POST', '/v1/admin/tenants', { token: sa, body: {
    slug: `bench-${i}`, name: `Barbearia Bench ${i}`, planId: i % 2 ? pro.id : trial.id,
    admin: { name: `Admin ${i}`, email: `admin${i}@bench.com`, password: 'benchpass123' } } });
}
const mainSlug = 'bench-0';
const mainTenantId = psql(`select id from tenants where slug='${mainSlug}'`);
const adm = (await must('POST', '/v1/auth/login', { body: { email: 'admin0@bench.com', password: 'benchpass123', tenantSlug: mainSlug } })).accessToken;

// Catálogo da barbearia principal (só na 1ª execução)
if (Number(psql(`select count(*) from services where tenant_id='${mainTenantId}'`)) === 0) {
  const svcs = [];
  for (let s = 0; s < 10; s++) svcs.push(await must('POST', '/v1/services', { token: adm, body: { name: `Serviço ${s}`, priceCents: 4000 + s * 500, durationMinutes: 30 } }));
  for (let p = 0; p < 12; p++) {
    const prof = await must('POST', '/v1/professionals', { token: adm, body: { name: `Barbeiro ${p}`, email: `barb${p}@bench.com`, password: 'benchpass123' } });
    for (let w = 0; w < 7; w++) await must('POST', `/v1/professionals/${prof.id}/working-hours`, { token: adm, body: { weekday: w, startTime: '08:00', endTime: '20:00' } });
    for (const s of svcs) await must('POST', `/v1/professionals/${prof.id}/services`, { token: adm, body: { serviceId: s.id } });
  }
  for (let c = 0; c < 30; c++) await must('POST', '/v1/auth/register', { body: { tenantSlug: mainSlug, name: `Cliente ${c}`, email: `cli${c}@bench.com`, password: 'benchpass123' } });
  // Volume: ~1 ano de agenda (passado + futuro) — 12 profissionais x 365 dias x 6 horários = ~26k agendamentos
  psql(`
    insert into appointments (tenant_id, client_id, professional_id, service_id, starts_at, ends_at, status)
    select '${mainTenantId}', c.id, p.id, s.id, ts, ts + interval '30 min',
      case when ts < now() then (case when random() < .8 then 'completed' else 'cancelled' end) else 'scheduled' end
    from (select id, row_number() over (order by id) rn from users where tenant_id='${mainTenantId}' and role='barbeiro') p
    cross join generate_series(date_trunc('day', now()) - interval '300 days', date_trunc('day', now()) + interval '60 days', interval '1 day') d
    cross join (values (9),(10),(11),(14),(15),(16)) h(hr)
    cross join lateral (select d + make_interval(hours => h.hr) ts) t
    cross join lateral (select id from users where tenant_id='${mainTenantId}' and role='cliente' order by md5(p.id::text || ts::text) limit 1) c
    cross join lateral (select id from services where tenant_id='${mainTenantId}' order by md5(ts::text || p.id::text) limit 1) s;`);
  // Pagamentos/repasses/atividade espalhados em todos os tenants (alimenta as telas do painel master)
  const tenants = psql(`select id from tenants`).split('\n');
  for (const t of tenants) {
    for (let m = 1; m <= 6; m++) {
      await must('POST', `/v1/admin/tenants/${t}/payments`, { token: sa, body: { amountCents: 14900, period: `2026-0${m}`, status: m < 6 ? 'paid' : 'pending' } });
    }
    await must('POST', `/v1/admin/tenants/${t}/payouts`, { token: sa, body: { period: '2026-09', grossRevenueCents: 500000, feePct: 5, status: 'pending' } });
  }
}
console.log('appointments:', psql(`select count(*) from appointments`), 'tenants:', psql(`select count(*) from tenants`), 'users:', psql(`select count(*) from users`));

const ids = (sql) => psql(sql).split('\n').filter(Boolean);
const [svcId] = ids(`select id from services where tenant_id='${mainTenantId}' and active order by created_at limit 1`);
const profIds = ids(`select id from users where tenant_id='${mainTenantId}' and role='barbeiro' and active and name like 'Barbeiro %' order by created_at`);
const profId = profIds[0];
const cliLogin = await call('POST', '/v1/auth/login', { body: { email: 'cli0@bench.com', password: 'benchpass123', tenantSlug: mainSlug } });
const cli = cliLogin.json.accessToken;
const refreshCookie = cliLogin.setCookie.split(';')[0];
const cliId = cliLogin.json.user.id;
const anyApptId = psql(`select id from appointments where tenant_id='${mainTenantId}' limit 1`);
const tenantB = psql(`select id from tenants where slug='bench-1'`);
const paymentId = psql(`select id from payments where tenant_id='${tenantB}' limit 1`);
const payoutId = psql(`select id from payouts where tenant_id='${tenantB}' limit 1`);
const whId = psql(`select id from working_hours where professional_id='${profId}' limit 1`);

// Datas livres (sem agendamento seed): de 70 dias à frente em diante, horário 12:00/13:00/17:00...
const future = (dayOffset, hour) => {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + dayOffset);
  return `${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00:00.000Z`;
};
const busyDate = future(10, 0).slice(0, 10);
let slot = 60 * (100 + Math.floor(Math.random() * 2500));

// Agendamentos auxiliares para cancel/complete/reschedule (não medidos)
async function newAppt(token) {
  slot++;
  const prof = profIds[slot % profIds.length];
  return must('POST', '/v1/appointments', { token, body: { serviceId: svcId, professionalId: prof, startsAt: future(70 + Math.floor(slot / 60), 8 + (slot % 11)) } });
}

// ─────────── MEDIÇÃO ───────────
const N = ITER;
const T = (token) => ({ token });
console.log('\n=== Medição ===');
await measure('GET /health', 'Health check', N, () => ({ method: 'GET', path: '/health' }));

// Públicas / auth
await measure('GET /v1/public/tenants/:slug', 'Branding público do tenant', N, () => ({ method: 'GET', path: `/v1/public/tenants/${mainSlug}` }));
await measure('POST /v1/auth/login', 'Login', N, () => ({ method: 'POST', path: '/v1/auth/login', opts: { body: { email: 'cli0@bench.com', password: 'benchpass123', tenantSlug: mainSlug } } }));
await measure('POST /v1/auth/register', 'Cadastro de cliente', N, (i) => ({ method: 'POST', path: '/v1/auth/register', opts: { body: { tenantSlug: mainSlug, name: 'Novo', email: `reg-${RUN}-${i}@bench.com`, password: 'benchpass123' } } }));
await measure('POST /v1/auth/refresh', 'Renova access token (cookie)', N, () => ({ method: 'POST', path: '/v1/auth/refresh', opts: { cookie: refreshCookie } }));
await measure('POST /v1/auth/logout', 'Logout', N, () => ({ method: 'POST', path: '/v1/auth/logout' }));

// Users
await measure('GET /v1/users/me', 'Perfil do usuário logado', N, () => ({ method: 'GET', path: '/v1/users/me', opts: T(cli) }));
await measure('GET /v1/users/:id', 'Usuário por id (tenant)', N, () => ({ method: 'GET', path: `/v1/users/${cliId}`, opts: T(adm) }));

// Tenants (admin barbearia)
await measure('GET /v1/tenants/me', 'Config/branding do próprio tenant', N, () => ({ method: 'GET', path: '/v1/tenants/me', opts: T(adm) }));
await measure('PATCH /v1/tenants/me', 'Atualiza branding', N, (i) => ({ method: 'PATCH', path: '/v1/tenants/me', opts: { token: adm, body: { primaryColor: i % 2 ? '#C9A84C' : '#B8973B' } } }));

// Services
await measure('GET /v1/services', 'Lista serviços (paginado)', N, () => ({ method: 'GET', path: '/v1/services', opts: T(cli) }));
await measure('GET /v1/services/:id', 'Detalhe de serviço', N, () => ({ method: 'GET', path: `/v1/services/${svcId}`, opts: T(cli) }));
await measure('POST /v1/services', 'Cria serviço', N, (i) => ({ method: 'POST', path: '/v1/services', opts: { token: adm, body: { name: `Bench ${RUN} ${i}`, priceCents: 1000, durationMinutes: 30 } } }));
await measure('PATCH /v1/services/:id', 'Edita serviço (preço)', N, (i) => ({ method: 'PATCH', path: `/v1/services/${svcId}`, opts: { token: adm, body: { priceCents: 4000 + i } } }));
await measure('GET /v1/services/:id/professionals', 'Profissionais que fazem o serviço', N, () => ({ method: 'GET', path: `/v1/services/${svcId}/professionals`, opts: T(cli) }));

// Professionals
await measure('GET /v1/professionals', 'Lista profissionais', N, () => ({ method: 'GET', path: '/v1/professionals', opts: T(cli) }));
await measure('GET /v1/professionals/:id', 'Detalhe de profissional', N, () => ({ method: 'GET', path: `/v1/professionals/${profId}`, opts: T(cli) }));
await measure('POST /v1/professionals', 'Cria profissional', N, (i) => ({ method: 'POST', path: '/v1/professionals', opts: { token: adm, body: { name: 'Novo barbeiro', email: `prof-${RUN}-${i}@bench.com`, password: 'benchpass123' } } }));
await measure('PATCH /v1/professionals/:id', 'Edita profissional (nome)', N, (i) => ({ method: 'PATCH', path: `/v1/professionals/${profId}`, opts: { token: adm, body: { name: `Barbeiro 0 v${i}` } } }));
// Inativar/reativar o profissional mais carregado (≈1.800 agendamentos futuros → needs_reschedule em lote e revert linha a linha)
const heavyProf = profIds[1];
const toggles = [];
for (let i = 0; i < Math.min(N, 5); i++) {
  const off = await call('PATCH', `/v1/professionals/${heavyProf}`, { token: adm, body: { active: false } });
  const on = await call('PATCH', `/v1/professionals/${heavyProf}`, { token: adm, body: { active: true } });
  toggles.push([off.ms, on.ms + 0, off.json.affectedAppointmentsCount, on.json.revertedAppointmentsCount, off.status, on.status]);
}
const summarize = (route, desc, arr, extra) => {
  const t = [...arr].sort((a, b) => a - b);
  const row = { route, desc, n: t.length, p50: t[Math.ceil(t.length / 2) - 1], p95: t.at(-1), max: t.at(-1), statuses: [200], extra };
  results.push(row);
  console.log(`${route.padEnd(62)} p50=${row.p50.toFixed(0).padStart(5)}ms max=${row.max.toFixed(0).padStart(5)}ms ${extra}`);
};
psql(`update users set active=true where id='${heavyProf}'; update appointments set status='scheduled' where status='needs_reschedule'`);
summarize('PATCH /v1/professionals/:id {active:false}', 'Inativa profissional (lote needs_reschedule)', toggles.map((x) => x[0]), `affected=${toggles[0][2]}`);
summarize('PATCH /v1/professionals/:id {active:true}', 'Reativa profissional (reverte linha a linha)', toggles.map((x) => x[1]), `reverted=${toggles[0][3]} status=${toggles.map(t=>t[5])}`);

// Professional services
await measure('GET /v1/professionals/:id/services', 'Serviços do profissional', N, () => ({ method: 'GET', path: `/v1/professionals/${profId}/services`, opts: T(cli) }));
const extraSvcs = ids(`select id from services where tenant_id='${mainTenantId}' and name like 'Bench ${RUN}%'`);
await measure('POST /v1/professionals/:id/services', 'Vincula serviço ao profissional', extraSvcs.length, (i) => ({ method: 'POST', path: `/v1/professionals/${profId}/services`, opts: { token: adm, body: { serviceId: extraSvcs[i] } } }));
await measure('DELETE /v1/professionals/:id/services/:sid', 'Desvincula serviço', extraSvcs.length, (i) => ({ method: 'DELETE', path: `/v1/professionals/${profId}/services/${extraSvcs[i]}`, opts: T(adm) }));

// Working hours
await measure('GET /v1/professionals/:id/working-hours', 'Horários de trabalho', N, () => ({ method: 'GET', path: `/v1/professionals/${profId}/working-hours`, opts: T(adm) }));
const newProf = ids(`select id from users where email like 'prof-${RUN}-%'`)[0];
const createdWh = [];
await measure('POST /v1/professionals/:id/working-hours', 'Cria horário de trabalho', N, (i) => ({ method: 'POST', path: `/v1/professionals/${newProf}/working-hours`, opts: { token: adm, body: { weekday: i % 7, startTime: '09:00', endTime: '18:00' } } }));
createdWh.push(...ids(`select id from working_hours where professional_id='${newProf}'`));
await measure('PATCH /v1/professionals/:id/working-hours/:whid', 'Edita horário de trabalho', N, (i) => ({ method: 'PATCH', path: `/v1/professionals/${newProf}/working-hours/${createdWh[0]}`, opts: { token: adm, body: { endTime: i % 2 ? '18:00' : '19:00' } } }));
await measure('DELETE /v1/professionals/:id/working-hours/:whid', 'Remove horário de trabalho', createdWh.length, (i) => ({ method: 'DELETE', path: `/v1/professionals/${newProf}/working-hours/${createdWh[i]}`, opts: T(adm) }));

// Availability & appointments
await measure('GET /v1/professionals/:id/availability', 'Horários livres do dia (agenda cheia)', N, () => ({ method: 'GET', path: `/v1/professionals/${profId}/availability?serviceId=${svcId}&date=${busyDate}`, opts: T(cli) }));
await measure('POST /v1/appointments', 'Cria agendamento', N, () => { slot++; return { method: 'POST', path: '/v1/appointments', opts: { token: cli, body: { serviceId: svcId, professionalId: profIds[slot % profIds.length], startsAt: future(70 + Math.floor(slot / 60), 8 + (slot % 11)) } } }; });
await measure('GET /v1/appointments (cliente)', 'Histórico do cliente', N, () => ({ method: 'GET', path: '/v1/appointments', opts: T(cli) }));
await measure('GET /v1/appointments (admin)', 'Agenda da barbearia (admin)', N, () => ({ method: 'GET', path: '/v1/appointments', opts: T(adm) }));
await measure('GET /v1/appointments?from&to (admin, semana)', 'Agenda da semana', N, () => ({ method: 'GET', path: `/v1/appointments?from=${future(0, 0)}&to=${future(7, 0)}&pageSize=100`, opts: T(adm) }));
await measure('GET /v1/appointments/:id', 'Detalhe de agendamento', N, () => ({ method: 'GET', path: `/v1/appointments/${anyApptId}`, opts: T(adm) }));
const forCancel = []; const forComplete = []; const forResched = [];
for (let i = 0; i < N; i++) { forCancel.push((await newAppt(cli)).id); forComplete.push((await newAppt(cli)).id); forResched.push((await newAppt(cli)).id); }
await measure('PATCH /v1/appointments/:id/cancel', 'Cancela agendamento', N, (i) => ({ method: 'PATCH', path: `/v1/appointments/${forCancel[i]}/cancel`, opts: T(cli) }));
await measure('PATCH /v1/appointments/:id/complete', 'Conclui agendamento (admin)', N, (i) => ({ method: 'PATCH', path: `/v1/appointments/${forComplete[i]}/complete`, opts: T(adm) }));
await measure('PATCH /v1/appointments/:id/reschedule', 'Remarca agendamento', N, (i) => { slot++; return { method: 'PATCH', path: `/v1/appointments/${forResched[i]}/reschedule`, opts: { token: cli, body: { startsAt: future(70 + Math.floor(slot / 60), 8 + (slot % 11)) } } }; });

// Inativa/reativa serviço com muitos agendamentos futuros
const heavySvc = ids(`select service_id from appointments where tenant_id='${mainTenantId}' and status='scheduled' group by 1 order by count(*) desc limit 1`)[0];
const st = [];
for (let i = 0; i < Math.min(N, 5); i++) {
  const off = await call('PATCH', `/v1/services/${heavySvc}`, { token: adm, body: { active: false } });
  const on = await call('PATCH', `/v1/services/${heavySvc}`, { token: adm, body: { active: true } });
  st.push([off.ms, on.ms, off.json.affectedAppointmentsCount, on.json.revertedAppointmentsCount, on.status]);
}
psql(`update services set active=true where id='${heavySvc}'; update appointments set status='scheduled' where status='needs_reschedule'`);
summarize('PATCH /v1/services/:id {active:false}', 'Inativa serviço (lote needs_reschedule)', st.map((x) => x[0]), `affected=${st[0][2]}`);
summarize('PATCH /v1/services/:id {active:true}', 'Reativa serviço (reverte linha a linha)', st.map((x) => x[1]), `reverted=${st[0][3]} status=${st.map(t=>t[4])}`);

// Presign (depende do Supabase Storage — sem credenciais aqui)
await measure('POST /v1/tenants/me/logo/presign', 'URL assinada p/ upload de logo', 3, () => ({ method: 'POST', path: '/v1/tenants/me/logo/presign', opts: { token: adm, body: { contentType: 'image/png' } } }));

// ─────────── Painel master (super_admin) ───────────
await measure('GET /v1/admin/whoami', 'Identidade do super admin', N, () => ({ method: 'GET', path: '/v1/admin/whoami', opts: T(sa) }));
await measure('GET /v1/admin/dashboard/overview', 'KPIs do painel master', N, () => ({ method: 'GET', path: '/v1/admin/dashboard/overview', opts: T(sa) }));
await measure('GET /v1/admin/activity', 'Atividade recente', N, () => ({ method: 'GET', path: '/v1/admin/activity?limit=10', opts: T(sa) }));
await measure('GET /v1/admin/users', 'Usuários de todos os tenants', N, () => ({ method: 'GET', path: '/v1/admin/users', opts: T(sa) }));
await measure('GET /v1/admin/tenants', 'Lista barbearias', N, () => ({ method: 'GET', path: '/v1/admin/tenants', opts: T(sa) }));
await measure('GET /v1/admin/tenants/:id', 'Detalhe barbearia', N, () => ({ method: 'GET', path: `/v1/admin/tenants/${tenantB}`, opts: T(sa) }));
await measure('POST /v1/admin/tenants', 'Provisiona barbearia (+admin +assinatura)', Math.min(N, 5), (i) => ({ method: 'POST', path: '/v1/admin/tenants', opts: { token: sa, body: { slug: `new-${RUN}-${i}`, name: 'Nova', planId: trial.id, admin: { name: 'Admin Novo', email: `a-${RUN}-${i}@bench.com`, password: 'benchpass123' } } } }));
await measure('PATCH /v1/admin/tenants/:id', 'Suspende/reativa barbearia', N, (i) => ({ method: 'PATCH', path: `/v1/admin/tenants/${tenantB}`, opts: { token: sa, body: { status: i % 2 ? 'active' : 'suspended' } } }));
psql(`update tenants set status='active' where id='${tenantB}'`);
await measure('GET /v1/admin/plans', 'Catálogo de planos', N, () => ({ method: 'GET', path: '/v1/admin/plans', opts: T(sa) }));
await measure('GET /v1/admin/plans/:id', 'Detalhe de plano', N, () => ({ method: 'GET', path: `/v1/admin/plans/${pro.id}`, opts: T(sa) }));
await measure('PATCH /v1/admin/plans/:id', 'Edita plano', N, (i) => ({ method: 'PATCH', path: `/v1/admin/plans/${pro.id}`, opts: { token: sa, body: { limitLabel: `até ${i} barbeiros` } } }));
const hasEnt = psql(`select count(*) from plans where code='enterprise'`) !== '0';
if (!hasEnt) await measure('POST /v1/admin/plans', 'Cria plano', 1, () => ({ method: 'POST', path: '/v1/admin/plans', opts: { token: sa, body: { code: 'enterprise', name: 'Enterprise', priceCents: 49900 } } }));
await measure('GET /v1/admin/subscriptions/overview', 'Resumo de assinaturas (Sprint 9 - endpoint cross-tenant /subscriptions removido)', N, () => ({ method: 'GET', path: '/v1/admin/subscriptions/overview', opts: T(sa) }));
await measure('GET /v1/admin/tenants/:id/subscription', 'Assinatura de um tenant', N, () => ({ method: 'GET', path: `/v1/admin/tenants/${tenantB}/subscription`, opts: T(sa) }));
await measure('PATCH /v1/admin/tenants/:id/subscription', 'Troca plano do tenant', N, (i) => ({ method: 'PATCH', path: `/v1/admin/tenants/${tenantB}/subscription`, opts: { token: sa, body: { planId: i % 2 ? pro.id : trial.id } } }));
await measure('GET /v1/admin/tenants/:id/payments', 'Pagamentos de um tenant (Sprint 8 — endpoint cross-tenant removido)', N, () => ({ method: 'GET', path: `/v1/admin/tenants/${tenantB}/payments`, opts: T(sa) }));
await measure('POST /v1/admin/tenants/:id/payments', 'Registra pagamento', N, () => ({ method: 'POST', path: `/v1/admin/tenants/${tenantB}/payments`, opts: { token: sa, body: { amountCents: 14900, period: '2026-10' } } }));
await measure('PATCH /v1/admin/tenants/:id/payments/:pid', 'Marca pagamento pago/pendente', N, (i) => ({ method: 'PATCH', path: `/v1/admin/tenants/${tenantB}/payments/${paymentId}`, opts: { token: sa, body: { status: i % 2 ? 'paid' : 'pending' } } }));
await measure('GET /v1/admin/payouts', 'Repasses de todos os tenants', N, () => ({ method: 'GET', path: '/v1/admin/payouts', opts: T(sa) }));
await measure('POST /v1/admin/tenants/:id/payouts', 'Registra repasse', N, () => ({ method: 'POST', path: `/v1/admin/tenants/${tenantB}/payouts`, opts: { token: sa, body: { period: '2026-10', grossRevenueCents: 100000, feePct: 5 } } }));
await measure('PATCH /v1/admin/tenants/:id/payouts/:pid', 'Marca repasse pago/pendente', N, (i) => ({ method: 'PATCH', path: `/v1/admin/tenants/${tenantB}/payouts/${payoutId}`, opts: { token: sa, body: { status: i % 2 ? 'paid' : 'pending' } } }));
await measure('GET /v1/admin/settings', 'Configurações da plataforma', N, () => ({ method: 'GET', path: '/v1/admin/settings', opts: T(sa) }));
await measure('PATCH /v1/admin/settings', 'Edita configurações', N, (i) => ({ method: 'PATCH', path: '/v1/admin/settings', opts: { token: sa, body: { defaultTrialDays: 14 + (i % 2) } } }));

writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`\nOK -> ${OUT}`);
