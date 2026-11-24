import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Inject,
  NotFoundException,
  Optional,
  PayloadTooLargeException,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { LOCAL_MEDIA, type LocalMediaStore } from './local-media.store.js';
import { isUploadKind } from './storage.constants.js';
import { StorageService, type PresignedUpload } from './storage.service.js';

interface PresignedUploadBody {
  kind?: unknown;
  contentType?: unknown;
  contentLength?: unknown;
}

async function readBody(req: Request, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limit)
      throw new PayloadTooLargeException('File lớn hơn dung lượng đã khai báo');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

@Controller('storage')
export class StorageController {
  constructor(
    private readonly storage: StorageService,
    @Optional()
    @Inject(LOCAL_MEDIA)
    private readonly local: LocalMediaStore | null = null,
  ) {}

  @Post('presigned-upload')
  @UseGuards(AuthGuard)
  createPresignedUpload(
    @Body() body: PresignedUploadBody,
  ): Promise<PresignedUpload> {
    const { kind, contentType, contentLength } = body ?? {};
    if (!isUploadKind(kind)) {
      throw new BadRequestException('kind phải là "cover" hoặc "audio"');
    }
    if (typeof contentType !== 'string' || contentType.length === 0) {
      throw new BadRequestException('contentType là bắt buộc');
    }
    if (typeof contentLength !== 'number') {
      throw new BadRequestException('contentLength phải là số byte');
    }
    return this.storage.createPresignedUpload({
      kind,
      contentType,
      contentLength,
    });
  }

  /** Nhận file cho kho local (chỉ bật khi chưa cấu hình R2). Quyền upload nằm ở chữ ký URL. */
  @Put('local-upload')
  @HttpCode(200)
  async localUpload(
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ key: string }> {
    if (!this.local || this.storage.mode !== 'local')
      throw new NotFoundException();
    const ticket = this.local.verify(query);
    if (!ticket)
      throw new ForbiddenException(
        'Chữ ký upload không hợp lệ hoặc đã hết hạn',
      );
    if (req.headers['content-type'] !== ticket.contentType) {
      throw new ForbiddenException('Content-Type không khớp với URL đã ký');
    }
    const body = await readBody(req, ticket.contentLength);
    if (body.length !== ticket.contentLength) {
      throw new ForbiddenException('Dung lượng file không khớp với URL đã ký');
    }
    await this.local.write(ticket.key, body);
    return { key: ticket.key };
  }
}
