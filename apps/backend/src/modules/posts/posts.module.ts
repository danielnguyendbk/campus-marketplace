import { Module } from '@nestjs/common';
import { VerificationGuard } from '../../common/auth/verification.guard';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PostRepository } from './repositories/post.repository';

@Module({
  imports: [AuthModule, CategoriesModule],
  controllers: [PostsController],
  providers: [PostRepository, PostsService, VerificationGuard],
  exports: [PostRepository, PostsService],
})
export class PostsModule {}
