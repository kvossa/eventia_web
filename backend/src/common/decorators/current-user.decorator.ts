import type { Request } from 'express';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@eventia/shared';

export interface AuthUserPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUserPayload;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUserPayload => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);