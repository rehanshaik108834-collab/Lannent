import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ALL_ROLES } from '../constants/roles';
import type { Role } from '../constants/roles';

/** The authenticated account performing a request, as established by AuthMiddleware. */
export interface Actor {
  id: string;
  role: Role;
  email?: string;
}

/** Validate the middleware boundary, including development compatibility identities. */
export function verifiedActor(user: unknown): Actor {
  if (
    !user ||
    typeof user !== 'object' ||
    !('id' in user) ||
    typeof user.id !== 'string' ||
    !user.id ||
    !('role' in user) ||
    typeof user.role !== 'string' ||
    !(ALL_ROLES as readonly string[]).includes(user.role)
  ) {
    throw new UnauthorizedException('Sign in to perform this action.');
  }
  return {
    id: user.id,
    role: user.role as Role,
    email:
      'email' in user && typeof user.email === 'string'
        ? user.email
        : undefined,
  };
}

/** Supplies middleware identity. Never derives authority from request bodies or raw headers. */
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor =>
    verifiedActor(ctx.switchToHttp().getRequest<{ user?: unknown }>().user),
);
