import { type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { extractToken } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';

/**
 * Rate limit theo người dùng (nếu đã đăng nhập) hoặc theo IP thật của client.
 * Mọi request từ web đi qua proxy Next/Vercel, nên không thể chỉ dựa vào IP kết nối.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  // ThrottlerGuard đã cố định tham số constructor → inject qua thuộc tính
  @Inject(AuthService) private readonly auth!: AuthService;

  protected override async shouldSkip(
    context: ExecutionContext,
  ): Promise<boolean> {
    return context.getType() !== 'http'; // Socket.io có cơ chế chống spam riêng
  }

  protected override async getTracker(
    req: Record<string, any>,
  ): Promise<string> {
    const request = req as Request;
    const token = extractToken(request);
    const session = token ? await this.auth.verifyToken(token) : null;
    if (session) return `user:${session.sub}`;
    return `ip:${request.ip ?? request.socket.remoteAddress ?? 'unknown'}`;
  }
}
