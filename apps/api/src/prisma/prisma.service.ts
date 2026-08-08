import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Client Prisma global, SEM tenant context.
 *
 * Uso permitido apenas em:
 *  - rotas /admin/* do Super Admin (tabela `tenants`, que não tem RLS — seção 6.4 do CLAUDE.md);
 *  - a própria TenantContextService, para abrir a transação com tenant context.
 *
 * Nunca usar este client para consultar tabelas com RLS (users, services,
 * professional_services, working_hours, appointments) fora de uma transação com
 * `set_config('app.current_tenant_id', ...)` — a query vai falhar (RLS ativo sem
 * contexto definido) ou, pior, escapar do isolamento de tenant se a policy não
 * estiver corretamente configurada. Use sempre `TenantContextService.runInTenantContext`.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
