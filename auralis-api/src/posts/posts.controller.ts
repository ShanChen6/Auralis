import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { PostsService, isMoodTag } from './posts.service.js';
import type { PostCard, PostDetail, PostList } from './posts.types.js';

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new BadRequestException('limit phải là số nguyên dương');
  }
  return limit;
}

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get('featured')
  featured(@Query('limit') limit?: string): Promise<PostCard[]> {
    return this.posts.findFeatured(parseLimit(limit));
  }

  @Get()
  list(
    @Query('mood') mood?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<PostList> {
    if (mood !== undefined && !isMoodTag(mood)) {
      throw new BadRequestException(`mood không hợp lệ: ${mood}`);
    }
    return this.posts.findMany({
      mood,
      category,
      cursor,
      limit: parseLimit(limit),
    });
  }

  @Get(':slug')
  detail(@Param('slug') slug: string): Promise<PostDetail> {
    return this.posts.findBySlug(slug);
  }
}
