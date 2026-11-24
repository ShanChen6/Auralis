import { Injectable } from '@nestjs/common';

/** Số người đang nghe theo phòng (Gateway cập nhật, REST đọc) */
@Injectable()
export class PresenceRegistry {
  private readonly counts = new Map<string, number>();

  set(roomId: string, count: number): void {
    if (count > 0) this.counts.set(roomId, count);
    else this.counts.delete(roomId);
  }

  get(roomId: string): number {
    return this.counts.get(roomId) ?? 0;
  }
}
