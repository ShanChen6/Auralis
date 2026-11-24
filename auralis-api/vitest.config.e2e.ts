import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      // PrismaService cần biến này để khởi tạo; kết nối chỉ mở khi có truy vấn.
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://auralis:auralis@localhost:5432/auralis?schema=public',
    },
  },
});
