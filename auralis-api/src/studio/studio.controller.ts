import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard.js';
import type { SessionPayload } from '../auth/auth.types.js';
import { UserRole } from '../generated/prisma/enums.js';
import { type CreatePostInput, createPostSchema } from './studio.schemas.js';
import {
  StudioService,
  type StudioPost,
  type StudioQuota,
} from './studio.service.js';

@Controller('studio')
@UseGuards(AuthGuard)
export class StudioController {
  constructor(private readonly studio: StudioService) {}

  /** Tạo bài mới ở trạng thái PENDING (chờ duyệt). Chống spam: tối đa 3 bài/phút + giới hạn ngày */
  @Post('posts')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  create(
    @CurrentUser() user: SessionPayload,
    @Body({ schema: createPostSchema }) body: CreatePostInput,
  ): Promise<StudioPost> {
    return this.studio.createPost(user.sub, body, user.role);
  }

  /** Số bài còn được đăng hôm nay + quyền tạo audio */
  @Get('quota')
  quota(@CurrentUser() user: SessionPayload): Promise<StudioQuota> {
    return this.studio.quotaStatus(user.sub, user.role);
  }

  /** Bài của tôi kèm trạng thái duyệt / trạng thái giọng đọc */
  @Get('posts')
  mine(@CurrentUser() user: SessionPayload): Promise<StudioPost[]> {
    return this.studio.listMine(user.sub);
  }

  @Post('posts/:id/retry-audio')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  retry(@Param('id', ParseUUIDPipe) id: string): Promise<StudioPost> {
    return this.studio.retryAudio(id);
  }
}
