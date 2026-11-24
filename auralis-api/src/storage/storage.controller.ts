import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { isUploadKind } from './storage.constants.js';
import { StorageService, type PresignedUpload } from './storage.service.js';

interface PresignedUploadBody {
  kind?: unknown;
  contentType?: unknown;
  contentLength?: unknown;
}

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  // TODO(Giai đoạn 4): thêm AuthGuard khi có đăng nhập – hiện ai cũng xin được URL.
  @Post('presigned-upload')
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
}
