import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Client transacional com tenant context já configurado via RLS (SET LOCAL). */
export type TenantTx = Prisma.TransactionClient;

/**
 * Implementa o mecanismo obrigatório da seção 6.3 do CLAUDE.md.
 *
 * `current_setting('app.current_tenant_id')` é uma variável de SESSÃO do Postgres.
 * Como as conexões são reaproveitadas por um pool (Supabase Supavisor em produção),
 * um `SET` comum vazaria o tenant_id para a próxima request que reusar a mesma
 * conexão física. Por isso todo acesso a dado de tenant passa por uma transação
 * interativa do Prisma com `set_config(..., true)` — o terceiro argumento `true`
 * equivale a `SET LOCAL`, escopo de transação, descartado no COMMIT/ROLLBACK.
 */
@Injectable()
export class TenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  async runInTenantContext<T>(
    tenantId: string,
    fn: (tx: TenantTx) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Parametrizado ($1) — nunca concatenação de string, mesmo com tenantId
      // já validado a partir de um JWT (defesa em profundidade contra SQL injection).
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }
}
