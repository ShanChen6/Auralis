import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard.js';
import { UserRole } from '../generated/prisma/enums.js';
import type { SessionPayload } from '../auth/auth.types.js';
import {
  type ClaimInput,
  type SubmitInput,
  claimSchema,
  submitSchema,
} from './narrations.schemas.js';
import {
  type MyNarration,
  NarrationsService,
  type OpenPost,
} from './narrations.service.js';

/**
 * Lồng tiếng cho bài chỉ có chữ. Theo chính sách quyền: chỉ ban biên tập
 * (biên tập viên, quản trị viên) được tạo audio, nên toàn bộ API này giới hạn cho họ.
 */
@Controller('narrations')
@UseGuards(AuthGuard)
@Roles(UserRole.EDITOR, UserRole.ADMIN)
export class NarrationsController {
  constructor(private readonly narrations: NarrationsService) {}

  @Get('open')
  open(@CurrentUser() user: SessionPayload): Promise<OpenPost[]> {
    return this.narrations.listOpen(user.sub);
  }

  @Get('mine')
  mine(@CurrentUser() user: SessionPayload): Promise<MyNarration[]> {
    return this.narrations.listMine(user.sub);
  }

  @Post()
  claim(
    @CurrentUser() user: SessionPayload,
    @Body({ schema: claimSchema }) body: ClaimInput,
  ): Promise<MyNarration> {
    return this.narrations.claim(user.sub, body);
  }

  @Post(':id/submit')
  submit(
    @CurrentUser() user: SessionPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: submitSchema }) body: SubmitInput,
  ): Promise<MyNarration> {
    return this.narrations.submit(user.sub, id, body);
  }

  @Post(':id/withdraw')
  withdraw(
    @CurrentUser() user: SessionPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MyNarration> {
    return this.narrations.withdraw(user.sub, id);
  }
}
