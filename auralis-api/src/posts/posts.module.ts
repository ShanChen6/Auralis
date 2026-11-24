import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  controllers: [PostsController, CategoriesController],
  providers: [PostsService],
})
export class PostsModule {}
