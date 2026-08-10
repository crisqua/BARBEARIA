const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
