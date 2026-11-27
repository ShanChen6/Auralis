import type { UserRole } from '../generated/prisma/enums.js';

/** Nội dung JWT phiên đăng nhập */
export interface SessionPayload {
  sub: string;
  role: UserRole;
  username: string;
}

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
}

export const SESSION_COOKIE = 'auralis_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const SOCKET_TOKEN_TTL_SECONDS = 5 * 60;

export function jwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET phải dài tối thiểu 32 ký tự ở môi trường production',
    );
  }
  return 'auralis-dev-secret-chi-dung-cho-moi-truong-local';
}
