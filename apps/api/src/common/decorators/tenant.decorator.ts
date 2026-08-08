import {
  ExecutionContext,
  InternalServerErrorException,
  createParamDecorator,
} from '@nestjs/common';
import { TenantTx } from '../../prisma/tenant-context.service';
import { RequestWithTenant } from '../types/request-with-tenant';

/**
 * Injeta o client transacional (`tx`) já com tenant context aplicado (RLS via
 * SET LOCAL — seção 6.3 do CLAUDE.md). Repositórios/controllers devem sempre
 * usar esse `tx`, nunca o `PrismaService` global, para consultas de negócio.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantTx => {
    const request = ctx.switchToHttp().getRequest<RequestWithTenant>();

    if (!request.tenantTx) {
      throw new InternalServerErrorException(
        '@CurrentTenant() usado em uma rota sem TenantContextInterceptor.',
      );
    }

    return request.tenantTx;
  },
);
