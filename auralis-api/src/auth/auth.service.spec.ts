import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { hashPassword } from './password.js';

const user = {
  id: 'u1',
  email: 'shan@auralis.vn',
  username: 'shan',
  displayName: 'Shan',
  avatarUrl: null,
  role: 'AUTHOR' as const,
};

function setup() {
  const prisma = {
    user: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  };
  const jwt = new JwtService({ secret: 'test-secret-test-secret-test-secret' });
  return {
    prisma,
    service: new AuthService(prisma as unknown as PrismaService, jwt),
  };
}

describe('AuthService', () => {
  it('đăng ký: báo trùng email / tên đăng nhập', async () => {
    const { prisma, service } = setup();
    const input = {
      email: 'shan@auralis.vn',
      username: 'shan',
      displayName: 'Shan',
      password: '12345678',
    };
    prisma.user.findFirst.mockResolvedValueOnce({ email: 'shan@auralis.vn' });
    await expect(service.register(input)).rejects.toThrow(
      'Email đã được sử dụng',
    );
    prisma.user.findFirst.mockResolvedValueOnce({ email: 'khac@auralis.vn' });
    await expect(service.register(input)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('đăng ký: băm mật khẩu, vai trò AUTHOR', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);
    await service.register({
      email: user.email,
      username: 'shan',
      displayName: 'Shan',
      password: '12345678',
    });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.role).toBe('AUTHOR');
    expect(data.passwordHash).toMatch(/^scrypt\$/);
    expect(data.passwordHash).not.toContain('12345678');
  });

  it('đăng nhập bằng email hoặc username (không phân biệt hoa thường)', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue({
      ...user,
      passwordHash: await hashPassword('dung-mat-khau'),
    });
    const result = await service.login({
      login: 'SHAN',
      password: 'dung-mat-khau',
    });
    expect(result).toEqual(user);
    expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({
      OR: [{ email: 'shan' }, { username: 'shan' }],
    });
  });

  it('đăng nhập sai mật khẩu hoặc không có tài khoản → 401', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValueOnce({
      ...user,
      passwordHash: await hashPassword('dung'),
    });
    await expect(
      service.login({ login: 'shan', password: 'sai' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.user.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.login({ login: 'ai-do', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('phát và xác minh token phiên', async () => {
    const { service } = setup();
    const token = await service.issueSessionToken(user);
    await expect(service.verifyToken(token)).resolves.toMatchObject({
      sub: 'u1',
      role: 'AUTHOR',
      username: 'shan',
    });
    await expect(service.verifyToken(token + 'x')).resolves.toBeNull();
  });
});
