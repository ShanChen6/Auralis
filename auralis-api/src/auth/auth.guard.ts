import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/enums.js';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE, type SessionPayload } from './auth.types.js';

export type AuthedRequest = Request & { user?: SessionPayload };

export function extractToken(req: Request): string | null {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[
    SESSION_COOKIE
  ];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

const ROLES_KEY = 'auralis:roles';
const OPTIONAL_KEY = 'auralis:optional-auth';

/** Chỉ cho phép các vai trò này (cần kèm AuthGuard) */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
/** Có đăng nhập thì gắn user, không có cũng cho qua */
export const OptionalAuth = () => SetMetadata(OPTIONAL_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const targets = [context.getHandler(), context.getClass()];
    const optional = this.reflector.getAllAndOverride<boolean>(
      OPTIONAL_KEY,
      targets,
    );
    const token = extractToken(req);
    const session = token ? await this.auth.verifyToken(token) : null;

    if (!session) {
      if (optional) return true;
      throw new UnauthorizedException('Vui lòng đăng nhập');
    }
    req.user = session;

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (roles?.length && !roles.includes(session.role)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): SessionPayload | undefined =>
    context.switchToHttp().getRequest<AuthedRequest>().user,
);
