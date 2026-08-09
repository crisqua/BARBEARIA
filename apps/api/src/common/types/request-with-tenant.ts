import type { Request } from 'express';
import type { TenantTx } from '../../prisma/tenant-context.service';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';

/**
 * `user`/`tenantId` são preenchidos pelo JwtAuthGuard a partir do JWT validado —
 * nunca devem vir de URL, query string ou body (regra 6.1.1 do CLAUDE.md).
 * `tenantTx` é preenchido pelo TenantContextInterceptor e consumido via @CurrentTenant().
 */
export interface RequestWithTenant extends Request {
  user?: AuthenticatedUser;
  tenantId?: string;
  tenantTx?: TenantTx;
}
