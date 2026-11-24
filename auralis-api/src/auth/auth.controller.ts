import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  type LoginInput,
  type RegisterInput,
  loginSchema,
  registerSchema,
} from './auth.schemas.js';
import { AuthGuard, CurrentUser } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type SessionPayload,
  type SessionUser,
} from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body({ schema: registerSchema }) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    const user = await this.auth.register(body);
    await this.setSession(res, user);
    return user;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: loginSchema }) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    const user = await this.auth.login(body);
    await this.setSession(res, user);
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() session: SessionPayload): Promise<SessionUser> {
    return this.auth.me(session.sub);
  }

  @Get('socket-token')
  @UseGuards(AuthGuard)
  async socketToken(
    @CurrentUser() session: SessionPayload,
  ): Promise<{ token: string }> {
    return { token: await this.auth.issueSocketToken(session) };
  }

  private async setSession(res: Response, user: SessionUser): Promise<void> {
    res.cookie(SESSION_COOKIE, await this.auth.issueSessionToken(user), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
  }
}
