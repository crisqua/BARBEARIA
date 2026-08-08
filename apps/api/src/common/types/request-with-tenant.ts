import type { Request } from 'express';
import type { TenantTx } from '../../prisma/tenant-context.service';

/**
 * `tenantId` é preenchido pelo AuthGuard a partir do JWT validado (Sprint 2) —
 * nunca deve vir de URL, query string ou body (regra 6.1.1 do CLAUDE.md).
 * `tenantTx` é preenchido pelo TenantContextInterceptor e consumido via @CurrentTenant().
 */
export interface RequestWithTenant extends Request {
  tenantId?: string;
  tenantTx?: TenantTx;
}
