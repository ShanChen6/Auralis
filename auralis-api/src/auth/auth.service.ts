import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import {
  SESSION_TTL_SECONDS,
  SOCKET_TOKEN_TTL_SECONDS,
  type SessionPayload,
  type SessionUser,
} from './auth.types.js';
import { hashPassword, verifyPassword } from './password.js';

const userSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  role: true,
} as const;

// Băm sẵn để thời gian phản hồi khi sai tên đăng nhập ≈ khi sai mật khẩu
const DUMMY_HASH = hashPassword('auralis-dummy-password');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<SessionUser> {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] },
      select: { email: true },
    });
    if (exists) {
      throw new ConflictException(
        exists.email === input.email
          ? 'Email đã được sử dụng'
          : 'Tên đăng nhập đã có người dùng',
      );
    }
    // Nền tảng cộng đồng: thành viên mới có thể viết bài ngay (bài vẫn qua kiểm duyệt)
    return this.prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
        role: UserRole.AUTHOR,
      },
      select: userSelect,
    });
  }

  async login(input: LoginInput): Promise<SessionUser> {
    const login = input.login.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: login }, { username: login }] },
      select: { ...userSelect, passwordHash: true },
    });
    const valid = user?.passwordHash
      ? await verifyPassword(input.password, user.passwordHash)
      : (await verifyPassword(input.password, await DUMMY_HASH), false);
    if (!user || !valid) {
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    }
    const { passwordHash: _ignored, ...sessionUser } = user;
    return sessionUser;
  }

  async me(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!user)
      throw new UnauthorizedException('Phiên đăng nhập không còn hợp lệ');
    return user;
  }

  issueSessionToken(user: SessionUser): Promise<string> {
    const payload: SessionPayload = {
      sub: user.id,
      role: user.role,
      username: user.username,
    };
    return this.jwt.signAsync(payload, { expiresIn: SESSION_TTL_SECONDS });
  }

  /** Token ngắn hạn cho Socket.io (client gửi qua handshake.auth.token) */
  issueSocketToken(session: SessionPayload): Promise<string> {
    const payload: SessionPayload = {
      sub: session.sub,
      role: session.role,
      username: session.username,
    };
    return this.jwt.signAsync(payload, { expiresIn: SOCKET_TOKEN_TTL_SECONDS });
  }

  async verifyToken(token: string): Promise<SessionPayload | null> {
    try {
      return await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      return null;
    }
  }
}
