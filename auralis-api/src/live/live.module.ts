import { Module } from '@nestjs/common';
import { LiveRoomsController } from './live-rooms.controller.js';
import { LiveRoomsService } from './live-rooms.service.js';
import { LiveGateway } from './live.gateway.js';
import { PresenceRegistry } from './presence.registry.js';

@Module({
  controllers: [LiveRoomsController],
  providers: [LiveRoomsService, PresenceRegistry, LiveGateway],
})
export class LiveModule {}
