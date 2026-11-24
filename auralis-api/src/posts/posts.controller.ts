import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { extractToken } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { PostsService, isMoodTag } from './posts.service.js';
import type {
  PostCard,
  PostDetail,
  PostList,
  RankedPost,
} from './posts.types.js';

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
  constructor(
    private readonly posts: PostsService,
    private readonly auth: AuthService,
  ) {}

  @Get('top-week')
  topWeek(@Query('limit') limit?: string): Promise<RankedPost[]> {
    return this.posts.topOfWeek(parseLimit(limit));
  }

  /** Trình phát gọi khi người dùng đã nghe đủ lâu (≥30s hoặc nửa bài) */
  @Post(':id/listen')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async listen(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<{ counted: boolean }> {
    const token = extractToken(req);
    const session = token ? await this.auth.verifyToken(token) : null;
    return this.posts.recordListen(
      id,
      session ? `user:${session.sub}` : `ip:${req.ip ?? 'unknown'}`,
    );
  }

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
