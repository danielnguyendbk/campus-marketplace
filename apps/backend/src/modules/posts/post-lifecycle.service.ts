import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { ClosePostDto } from './dto/close-post.dto';
import { PostDetailDto } from './posts.types';
import { PostsService } from './posts.service';
import { PostRepository } from './repositories/post.repository';

@Injectable()
export class PostLifecycleService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly postsService: PostsService,
  ) {}

  async hidePost(postId: string, user: AuthenticatedUser): Promise<PostDetailDto> {
    const found = await this.postRepository.findPostDetailById(postId);
    if (!found) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Không tìm thấy bài đăng.',
      });
    }

    const { post } = found;
    if (post.owner_id !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền thay đổi trạng thái bài đăng này.',
      });
    }

    if (post.status === 'HIDDEN') {
      throw new ConflictException({
        code: 'POST_ALREADY_HIDDEN',
        message: 'Bài đăng hiện đã ở trạng thái ẩn.',
      });
    }

    if (post.status === 'SOLD' || post.status === 'CLOSED') {
      throw new ConflictException({
        code: 'POST_TERMINATED',
        message: 'Không thể ẩn bài đăng đã kết thúc (SOLD/CLOSED).',
      });
    }

    await this.postRepository.updatePostStatus(postId, 'HIDDEN');

    const updated = await this.postRepository.findPostDetailById(postId);
    return this.postsService.mapPostDetailRow(updated!.post, updated!.images);
  }

  async activatePost(postId: string, user: AuthenticatedUser): Promise<PostDetailDto> {
    const found = await this.postRepository.findPostDetailById(postId);
    if (!found) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Không tìm thấy bài đăng.',
      });
    }

    const { post } = found;
    if (post.owner_id !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền thay đổi trạng thái bài đăng này.',
      });
    }

    if (post.status === 'ACTIVE') {
      throw new ConflictException({
        code: 'POST_ALREADY_ACTIVE',
        message: 'Bài đăng hiện đang ở trạng thái hoạt động.',
      });
    }

    if (post.status === 'SOLD' || post.status === 'CLOSED') {
      throw new ConflictException({
        code: 'POST_TERMINATED',
        message: 'Không thể kích hoạt lại bài đăng đã kết thúc (SOLD/CLOSED).',
      });
    }

    await this.postRepository.updatePostStatus(postId, 'ACTIVE');

    const updated = await this.postRepository.findPostDetailById(postId);
    return this.postsService.mapPostDetailRow(updated!.post, updated!.images);
  }

  async markPostSold(postId: string, user: AuthenticatedUser): Promise<PostDetailDto> {
    const found = await this.postRepository.findPostDetailById(postId);
    if (!found) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Không tìm thấy bài đăng.',
      });
    }

    const { post } = found;
    if (post.owner_id !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền thay đổi trạng thái bài đăng này.',
      });
    }

    if (post.post_type !== 'SELL') {
      throw new ConflictException({
        code: 'INVALID_POST_TYPE',
        message: 'Tính năng đánh dấu đã bán chỉ áp dụng cho tin đăng bán (SELL).',
      });
    }

    if (post.status === 'SOLD') {
      throw new ConflictException({
        code: 'POST_ALREADY_SOLD',
        message: 'Bài đăng đã được đánh dấu bán trước đó.',
      });
    }

    if (post.status === 'CLOSED') {
      throw new ConflictException({
        code: 'POST_TERMINATED',
        message: 'Bài đăng đã đóng, không thể chuyển sang đã bán.',
      });
    }

    await this.postRepository.updatePostStatus(postId, 'SOLD', {
      endedAt: new Date(),
    });

    const updated = await this.postRepository.findPostDetailById(postId);
    return this.postsService.mapPostDetailRow(updated!.post, updated!.images);
  }

  async closePost(
    postId: string,
    user: AuthenticatedUser,
    dto: ClosePostDto,
  ): Promise<PostDetailDto> {
    const found = await this.postRepository.findPostDetailById(postId);
    if (!found) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Không tìm thấy bài đăng.',
      });
    }

    const { post } = found;
    if (post.owner_id !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền thay đổi trạng thái bài đăng này.',
      });
    }

    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Lý do đóng bài đăng không được để trống.',
        details: [{ field: 'reason', message: 'Lý do đóng bài đăng không được để trống.' }],
      });
    }

    if (post.status === 'CLOSED') {
      throw new ConflictException({
        code: 'POST_ALREADY_CLOSED',
        message: 'Bài đăng đã được đóng trước đó.',
      });
    }

    if (post.status === 'SOLD') {
      throw new ConflictException({
        code: 'POST_TERMINATED',
        message: 'Bài đăng đã bán, không thể đóng.',
      });
    }

    await this.postRepository.updatePostStatus(postId, 'CLOSED', {
      closeReason: reason,
      endedAt: new Date(),
    });

    const updated = await this.postRepository.findPostDetailById(postId);
    return this.postsService.mapPostDetailRow(updated!.post, updated!.images);
  }
}

