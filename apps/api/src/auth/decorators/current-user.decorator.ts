import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { RequestWithTenant } from '../../common/types/request-with-tenant';
import { AuthenticatedUser } from '../types/authenticated-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithTenant>();
    return request.user;
  },
);
