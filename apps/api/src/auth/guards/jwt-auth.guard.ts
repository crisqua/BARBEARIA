import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RequestWithTenant } from '../../common/types/request-with-tenant';
import { AuthenticatedUser, UserRole } from '../types/authenticated-user';

interface AccessPayload {
  sub: string;
  tenantId: string | null;
  role: UserRole;
}

/**
 * Valida o access token (Authorization: Bearer) e popula request.user +
 * request.tenantId — nunca lidos de URL/query/body (regra 6.1.1 do CLAUDE.md).
 * Roda antes do TenantContextInterceptor na pipeline do Nest (Guards → Interceptors).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token de acesso ausente.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessPayload>(token, {
        secret: process.env.JWT_SECRET,
      });

      const user: AuthenticatedUser = { id: payload.sub, tenantId: payload.tenantId, role: payload.role };
      request.user = user;
      if (user.tenantId) {
        request.tenantId = user.tenantId;
      }
      return true;
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado.');
    }
  }

  private extractToken(request: RequestWithTenant): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    return header.slice('Bearer '.length).trim() || undefined;
  }
}
