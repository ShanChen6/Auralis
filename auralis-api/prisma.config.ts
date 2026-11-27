import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migration cần kết nối trực tiếp (không qua PgBouncer/pooler của Supabase, Neon)
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
