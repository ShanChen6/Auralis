import { Controller, Get, Param } from '@nestjs/common';
import { type LiveRoomState, LiveRoomsService } from './live-rooms.service.js';

@Controller('live-rooms')
export class LiveRoomsController {
  constructor(private readonly rooms: LiveRoomsService) {}

  @Get()
  list(): Promise<LiveRoomState[]> {
    return this.rooms.list();
  }

  @Get(':slug')
  detail(@Param('slug') slug: string): Promise<LiveRoomState> {
    return this.rooms.getState(slug);
  }
}
