import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

/** super_admin nunca chega em rotas de tenant (RolesGuard barra antes), mas o TS não sabe disso. */
export function requireTenantId(user: AuthenticatedUser): string {
  if (!user.tenantId) {
    throw new ForbiddenException();
  }
  return user.tenantId;
}
