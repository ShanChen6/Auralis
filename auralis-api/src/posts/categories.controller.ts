import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../redis/cache.service.js';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  list(): Promise<{ slug: string; name: string }[]> {
    return this.cache.getOrSet('categories', 3600, () =>
      this.prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        select: { slug: true, name: true },
      }),
    );
  }
}
