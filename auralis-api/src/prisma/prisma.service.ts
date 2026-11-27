import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Prisma Client dùng driver adapter `pg` (bắt buộc từ Prisma 7).
 * Kết nối được mở lười ở truy vấn đầu tiên, nên app vẫn khởi động được
 * khi DB chưa sẵn sàng (VD: chạy test không cần database).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL chưa được cấu hình');
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
