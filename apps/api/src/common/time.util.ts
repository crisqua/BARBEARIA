const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Fuso horário assumido da barbearia — MVP não modela timezone por tenant
 * (seção 4 do CLAUDE.md, "decisão conscientemente adiada"). Fixo em pt-BR
 * por enquanto porque é o único mercado do MVP.
 */
const BARBERSHOP_TIMEZONE = 'America/Sao_Paulo';

export function isValidTimeString(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/**
 * Converte "HH:mm" para o Date que o Prisma espera para uma coluna @db.Time.
 * TIME do Postgres não tem timezone, então usamos sempre componentes UTC —
 * tanto aqui quanto em formatTimeString — pra não sofrer deslocamento pelo
 * fuso horário local do processo Node.
 */
export function parseTimeString(value: string): Date {
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Horário inválido: "${value}" (esperado HH:mm)`);
  }
  const [, hours, minutes] = match;
  return new Date(Date.UTC(1970, 0, 1, Number(hours), Number(minutes), 0));
}

export function formatTimeString(value: Date): string {
  const hours = value.getUTCHours().toString().padStart(2, '0');
  const minutes = value.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * "Agora", nos mesmos termos em que starts_at é armazenado: hora tratada
 * como a hora local da barbearia, sem conversão, via getters UTC.
 *
 * Usa Intl com timezone FIXO (BARBERSHOP_TIMEZONE), não o timezone do
 * processo Node — necessário porque em dev o processo roda em
 * America/Sao_Paulo, mas em produção (Render) roda em UTC. Sem isso, o
 * corte de "horário já passou" fica deslocado pelo offset do fuso do
 * servidor (ex: escondia como "passado" um slot das 11:00 quando na
 * verdade já eram 11:31 UTC mas só 08:31 no horário local da barbearia).
 */
export function nowInBarbershopTime(): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BARBERSHOP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);

  return new Date(
    Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')),
  );
}
