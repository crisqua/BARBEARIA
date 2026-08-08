import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { RequestWithTenant } from '../types/request-with-tenant';

/**
 * Aplica o mecanismo da seção 6.3 do CLAUDE.md em toda rota autenticada de tenant.
 * Nunca usar em rotas /admin/* do Super Admin (seção 6.4) — essas não têm tenant context.
 *
 * NOTA (Sprint 1 → Sprint 2): `request.tenantId` ainda não é populado por um AuthGuard
 * real, porque JWT/RBAC são escopo da Sprint 2. Por enquanto este interceptor só
 * funciona em rotas onde algo já setou `request.tenantId` antes dele (ex: nos testes
 * de isolamento). Quando o AuthGuard entrar, ele roda antes deste interceptor na
 * pipeline e popula `tenantId` a partir do JWT validado — nada aqui muda.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const tenantId = request.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException(
        'tenant_id ausente no contexto da requisição — rota precisa de um AuthGuard antes deste interceptor.',
      );
    }

    return from(
      this.tenantContext.runInTenantContext(tenantId, async (tx) => {
        request.tenantTx = tx;
        return lastValueFrom(next.handle());
      }),
    );
  }
}
