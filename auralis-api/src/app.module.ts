import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { LiveModule } from './live/live.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { NarrationsModule } from './narrations/narrations.module.js';
import { PostsModule } from './posts/posts.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RadioQueueModule } from './radio-queue/radio-queue.module.js';
import { StorageModule } from './storage/storage.module.js';
import { StudioModule } from './studio/studio.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StorageModule,
    RadioQueueModule,
    PostsModule,
    StudioModule,
    ModerationModule,
    NarrationsModule,
    LiveModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
