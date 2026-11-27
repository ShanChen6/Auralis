import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthService } from './auth.service.js';
import { AuthGuard, OptionalAuth, Roles } from './auth.guard.js';

class Handlers {
  plain() {}
  @Roles('EDITOR', 'ADMIN')
  editorOnly() {}
  @OptionalAuth()
  optional() {}
}

function context(
  handler: keyof Handlers,
  req: Record<string, unknown>,
): ExecutionContext {
  return {
    getHandler: () => Handlers.prototype[handler],
    getClass: () => Handlers,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function guard(session: object | null) {
  const auth = { verifyToken: vi.fn().mockResolvedValue(session) };
  return {
    auth,
    guard: new AuthGuard(auth as unknown as AuthService, new Reflector()),
  };
}

describe('AuthGuard', () => {
  it('đọc token từ cookie hoặc header Bearer', async () => {
    const { auth, guard: g } = guard({
      sub: 'u1',
      role: 'AUTHOR',
      username: 'a',
    });
    const req: Record<string, unknown> = {
      cookies: { auralis_session: 'tok' },
      headers: {},
    };
    await expect(g.canActivate(context('plain', req))).resolves.toBe(true);
    expect(auth.verifyToken).toHaveBeenCalledWith('tok');
    expect(req.user).toMatchObject({ sub: 'u1' });

    await g.canActivate(
      context('plain', { headers: { authorization: 'Bearer abc' } }),
    );
    expect(auth.verifyToken).toHaveBeenLastCalledWith('abc');
  });

  it('401 khi không có hoặc sai token', async () => {
    await expect(
      guard(null).guard.canActivate(context('plain', { headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('kiểm tra vai trò', async () => {
    const author = guard({ sub: 'u1', role: 'AUTHOR', username: 'a' }).guard;
    const req = { cookies: { auralis_session: 't' }, headers: {} };
    await expect(
      author.canActivate(context('editorOnly', req)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const editor = guard({ sub: 'u2', role: 'EDITOR', username: 'e' }).guard;
    await expect(editor.canActivate(context('editorOnly', req))).resolves.toBe(
      true,
    );
  });

  it('OptionalAuth cho qua khi chưa đăng nhập', async () => {
    await expect(
      guard(null).guard.canActivate(context('optional', { headers: {} })),
    ).resolves.toBe(true);
  });
});
