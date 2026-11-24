import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser, OptionalAuth } from '../auth/auth.guard.js';
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

/** Ghép cặp cộng đồng: thành viên có giọng đọc hay nhận lồng tiếng bài chỉ có chữ */
@Controller('narrations')
@UseGuards(AuthGuard)
export class NarrationsController {
  constructor(private readonly narrations: NarrationsService) {}

  @Get('open')
  @OptionalAuth()
  open(@CurrentUser() user?: SessionPayload): Promise<OpenPost[]> {
    return this.narrations.listOpen(user?.sub);
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
