import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard.js';
import type { SessionPayload } from '../auth/auth.types.js';
import { type CreatePostInput, createPostSchema } from './studio.schemas.js';
import { StudioService, type StudioPost } from './studio.service.js';

@Controller('studio')
@UseGuards(AuthGuard)
export class StudioController {
  constructor(private readonly studio: StudioService) {}

  /** Tạo bài mới ở trạng thái PENDING (chờ duyệt) */
  @Post('posts')
  create(
    @CurrentUser() user: SessionPayload,
    @Body({ schema: createPostSchema }) body: CreatePostInput,
  ): Promise<StudioPost> {
    return this.studio.createPost(user.sub, body, user.role);
  }

  /** Số lượt tạo Radio AI còn lại hôm nay */
  @Get('quota')
  quota(@CurrentUser() user: SessionPayload) {
    return this.studio.quotaStatus(user.sub, user.role);
  }

  /** Bài của tôi kèm trạng thái duyệt / trạng thái tạo Radio */
  @Get('posts')
  mine(@CurrentUser() user: SessionPayload): Promise<StudioPost[]> {
    return this.studio.listMine(user.sub);
  }

  @Post('posts/:id/retry-audio')
  retry(
    @CurrentUser() user: SessionPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudioPost> {
    return this.studio.retryAudio(user.sub, id);
  }
}
