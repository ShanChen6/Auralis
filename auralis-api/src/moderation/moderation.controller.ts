import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard.js';
import type { SessionPayload } from '../auth/auth.types.js';
import {
  NarrationStatus,
  PostStatus,
  UserRole,
} from '../generated/prisma/enums.js';
import {
  type ApprovePostInput,
  type RejectInput,
  type UpdatePostInput,
  approvePostSchema,
  narrationStatusQuery,
  postStatusQuery,
  rejectSchema,
  updatePostSchema,
} from './moderation.schemas.js';
import {
  ModerationService,
  type ReviewNarration,
  type ReviewPost,
} from './moderation.service.js';

/** Màn hình biên tập viên / admin */
@Controller('admin')
@UseGuards(AuthGuard)
@Roles(UserRole.EDITOR, UserRole.ADMIN)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('stats')
  stats() {
    return this.moderation.stats();
  }

  @Get('posts')
  posts(
    @Query({ schema: postStatusQuery }) query: { status: PostStatus },
  ): Promise<ReviewPost[]> {
    return this.moderation.listPosts(query.status);
  }

  @Patch('posts/:id/approve')
  approve(
    @CurrentUser() user: SessionPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: approvePostSchema }) body: ApprovePostInput,
  ): Promise<ReviewPost> {
    return this.moderation.approvePost(user.sub, id, body);
  }

  @Patch('posts/:id/reject')
  reject(
    @CurrentUser() user: SessionPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: rejectSchema }) body: RejectInput,
  ): Promise<ReviewPost> {
    return this.moderation.rejectPost(user.sub, id, body);
  }

  @Patch('posts/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updatePostSchema }) body: UpdatePostInput,
  ): Promise<ReviewPost> {
    return this.moderation.updatePost(id, body);
  }

  @Get('narrations')
  narrations(
    @Query({ schema: narrationStatusQuery }) query: { status: NarrationStatus },
  ): Promise<ReviewNarration[]> {
    return this.moderation.listNarrations(query.status);
  }

  @Patch('narrations/:id/approve')
  approveNarration(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReviewNarration> {
    return this.moderation.approveNarration(id);
  }

  @Patch('narrations/:id/reject')
  rejectNarration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: rejectSchema }) body: RejectInput,
  ): Promise<ReviewNarration> {
    return this.moderation.rejectNarration(id, body);
  }
}
