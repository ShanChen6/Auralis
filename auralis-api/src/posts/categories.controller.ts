import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(): Promise<{ slug: string; name: string }[]> {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, name: true },
    });
  }
}
