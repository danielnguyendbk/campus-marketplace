import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { StorageService } from '../../common/storage/storage.service';
import { PostgresService } from '../../database/postgres.service';
import { CategoriesRepository } from '../categories/categories.repository';
import { CreatePostDto } from './dto/create-post.dto';
import {
  ALLOWED_POST_IMAGE_MIMES,
  MAX_POST_IMAGES_COUNT,
  MAX_POST_IMAGE_BYTES,
  PostDetailDto,
  PostImageDto,
  PostStatus,
  PostSummaryDto,
  UserSummaryDto,
} from './posts.types';
import {
  PostDetailRow,
  PostImageRow,
  PostRepository,
  PostRow,
} from './repositories/post.repository';

@Injectable()
export class PostsService {
  constructor(
    private readonly postgresService: PostgresService,
    private readonly postRepository: PostRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly storageService: StorageService,
  ) {}

  async createPost(
    user: AuthenticatedUser,
    dto: CreatePostDto,
    files: Express.Multer.File[],
  ): Promise<PostDetailDto> {
    if (dto.postType === 'BUY_REQUEST') {
      return this.createBuyRequestPost(user, dto, files);
    }

    return this.createSellPost(user, dto, files);
  }

  async createSellPost(
    user: AuthenticatedUser,
    dto: CreatePostDto,
    files: Express.Multer.File[],
  ): Promise<PostDetailDto> {
    this.assertNoBudgetFields(dto);
    this.validateImageFiles(files, true);

    const price = dto.price;
    const condition = dto.condition;
    if (price === undefined || condition === undefined) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Tin đăng bán (SELL) bắt buộc có giá bán và tình trạng sản phẩm.',
        details: [
          {
            field: price === undefined ? 'price' : 'condition',
            message: 'Giá bán và tình trạng sản phẩm là bắt buộc với tin SELL.',
          },
        ],
      });
    }

    await this.assertActiveCategory(dto.categoryId);

    const allowPhoneReveal = dto.allowPhoneReveal ?? true;

    const { post, sellDetail, images } = await this.postgresService.withTransaction(
      async (client) => {
        const createdPost = await this.postRepository.insertPost(
          {
            ownerId: user.id,
            postType: 'SELL',
            title: dto.title,
            description: dto.description,
            categoryId: dto.categoryId,
            province: dto.province,
          },
          client,
        );

        const createdSellDetail = await this.postRepository.insertSellDetails(
          {
            postId: createdPost.id,
            price,
            condition,
            allowPhoneReveal,
          },
          client,
        );

        const createdImages = await this.uploadAndInsertImages(
          createdPost.id,
          files,
          client,
        );

        return {
          post: createdPost,
          sellDetail: createdSellDetail,
          images: createdImages,
        };
      },
    );

    const detail = this.buildCreatedPostDetail(user, post, images);
    detail.sellDetail = {
      price: Number(sellDetail.price),
      condition: sellDetail.condition,
      allowPhoneReveal: sellDetail.allow_phone_reveal,
    };

    return detail;
  }

  private async createBuyRequestPost(
    user: AuthenticatedUser,
    dto: CreatePostDto,
    files: Express.Multer.File[],
  ): Promise<PostDetailDto> {
    this.assertNoSellFields(dto);

    const budgetMin = dto.budgetMin;
    const budgetMax = dto.budgetMax;
    if (budgetMin === undefined || budgetMax === undefined) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Tin tìm mua (BUY_REQUEST) bắt buộc có ngân sách tối thiểu và tối đa.',
        details: [
          {
            field: budgetMin === undefined ? 'budgetMin' : 'budgetMax',
            message: 'budgetMin và budgetMax là bắt buộc với tin BUY_REQUEST.',
          },
        ],
      });
    }

    if (budgetMax < budgetMin) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Ngân sách tối đa phải lớn hơn hoặc bằng ngân sách tối thiểu.',
        details: [
          {
            field: 'budgetMax',
            message: 'budgetMax phải lớn hơn hoặc bằng budgetMin.',
          },
        ],
      });
    }

    this.validateImageFiles(files, false);
    await this.assertActiveCategory(dto.categoryId);

    const { post, buyRequestDetail, images } =
      await this.postgresService.withTransaction(async (client) => {
        const createdPost = await this.postRepository.insertPost(
          {
            ownerId: user.id,
            postType: 'BUY_REQUEST',
            title: dto.title,
            description: dto.description,
            categoryId: dto.categoryId,
            province: dto.province,
          },
          client,
        );

        const createdBuyRequestDetail =
          await this.postRepository.insertBuyRequestDetails(
            {
              postId: createdPost.id,
              budgetMin,
              budgetMax,
            },
            client,
          );

        const createdImages = await this.uploadAndInsertImages(
          createdPost.id,
          files,
          client,
        );

        return {
          post: createdPost,
          buyRequestDetail: createdBuyRequestDetail,
          images: createdImages,
        };
      });

    const detail = this.buildCreatedPostDetail(user, post, images);
    detail.buyRequestDetail = {
      budgetMin: Number(buyRequestDetail.budget_min),
      budgetMax: Number(buyRequestDetail.budget_max),
    };

    return detail;
  }

  async getPostById(
    postId: string,
    viewer: AuthenticatedUser,
  ): Promise<PostDetailDto> {
    const found = await this.postRepository.findPostDetailById(postId);
    if (!found) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Không tìm thấy bài đăng.',
      });
    }

    const { post, images } = found;
    if (
      post.status !== 'ACTIVE' &&
      viewer.id !== post.owner_id &&
      viewer.role !== 'ADMIN'
    ) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Không tìm thấy bài đăng.',
      });
    }

    return this.mapPostDetailRow(post, images);
  }

  async getMyPosts(
    user: AuthenticatedUser,
    rawPage?: number,
    rawLimit?: number,
    rawStatus?: string,
  ): Promise<PaginatedResult<PostSummaryDto>> {
    const page =
      Number.isInteger(rawPage) && (rawPage as number) >= 1
        ? (rawPage as number)
        : 1;
    const limit =
      Number.isInteger(rawLimit) && (rawLimit as number) >= 1
        ? Math.min(rawLimit as number, 100)
        : 20;

    let status: PostStatus | undefined;
    if (rawStatus !== undefined && rawStatus !== '') {
      if (!['ACTIVE', 'HIDDEN', 'SOLD', 'CLOSED'].includes(rawStatus)) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Trạng thái bài đăng không hợp lệ.',
          details: [
            {
              field: 'status',
              message: 'status phải thuộc ACTIVE, HIDDEN, SOLD hoặc CLOSED.',
            },
          ],
        });
      }
      status = rawStatus as PostStatus;
    }

    const { rows, total } = await this.postRepository.findMyPostsPaginated(
      user.id,
      page,
      limit,
      status,
    );

    const data: PostSummaryDto[] = rows.map((row) => ({
      id: row.id,
      postType: row.post_type,
      title: row.title,
      categoryId: row.category_id,
      province: row.province,
      status: row.status,
      price: row.price !== null ? Number(row.price) : null,
      budgetMin: row.budget_min !== null ? Number(row.budget_min) : null,
      budgetMax: row.budget_max !== null ? Number(row.budget_max) : null,
      thumbnailUrl: row.thumbnail_storage_key
        ? this.storageService.getPublicUrl(row.thumbnail_storage_key)
        : null,
      createdAt: this.toIsoString(row.created_at),
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private assertNoBudgetFields(dto: CreatePostDto): void {
    const details: Array<{ field: string; message: string }> = [];
    if (dto.budgetMin !== undefined) {
      details.push({
        field: 'budgetMin',
        message: 'Tin đăng bán (SELL) không được gửi kèm budgetMin.',
      });
    }
    if (dto.budgetMax !== undefined) {
      details.push({
        field: 'budgetMax',
        message: 'Tin đăng bán (SELL) không được gửi kèm budgetMax.',
      });
    }

    if (details.length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message:
          'Tin đăng bán (SELL) không được gửi kèm trường ngân sách của tin tìm mua (BUY_REQUEST).',
        details,
      });
    }
  }

  private assertNoSellFields(dto: CreatePostDto): void {
    const details: Array<{ field: string; message: string }> = [];
    if (dto.price !== undefined) {
      details.push({
        field: 'price',
        message: 'Tin tìm mua (BUY_REQUEST) không được gửi kèm price.',
      });
    }
    if (dto.condition !== undefined) {
      details.push({
        field: 'condition',
        message: 'Tin tìm mua (BUY_REQUEST) không được gửi kèm condition.',
      });
    }
    if (dto.allowPhoneReveal !== undefined) {
      details.push({
        field: 'allowPhoneReveal',
        message:
          'Tin tìm mua (BUY_REQUEST) không được gửi kèm allowPhoneReveal.',
      });
    }

    if (details.length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message:
          'Tin tìm mua (BUY_REQUEST) không được gửi kèm trường của tin đăng bán (SELL).',
        details,
      });
    }
  }

  private async assertActiveCategory(categoryId: string): Promise<void> {
    const category = await this.categoriesRepository.findActiveById(categoryId);
    if (!category) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Danh mục sản phẩm không hợp lệ.',
        details: [
          {
            field: 'categoryId',
            message: 'Danh mục không tồn tại hoặc đã ngừng hoạt động.',
          },
        ],
      });
    }
  }

  private async uploadAndInsertImages(
    postId: string,
    files: Express.Multer.File[],
    client: PoolClient,
  ): Promise<PostImageRow[]> {
    if (!files || files.length === 0) {
      return [];
    }

    const uploadedImages: Array<{ storageKey: string; sortOrder: number }> = [];
    for (let i = 0; i < files.length; i += 1) {
      const storageKey = await this.storageService.savePostImage(
        postId,
        files[i],
        i,
      );
      uploadedImages.push({ storageKey, sortOrder: i });
    }

    return this.postRepository.insertPostImages(postId, uploadedImages, client);
  }

  private validateImageFiles(
    files: Express.Multer.File[],
    requireAtLeastOne: boolean,
  ): void {
    if (!files || files.length === 0) {
      if (!requireAtLeastOne) {
        return;
      }

      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Tin đăng bán (SELL) bắt buộc có ít nhất 1 ảnh sản phẩm.',
        details: [
          {
            field: 'images',
            message: 'Vui lòng tải lên ít nhất 1 ảnh sản phẩm.',
          },
        ],
      });
    }

    if (files.length > MAX_POST_IMAGES_COUNT) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: `Mỗi bài đăng chỉ được tải lên tối đa ${MAX_POST_IMAGES_COUNT} ảnh.`,
        details: [
          {
            field: 'images',
            message: `Tối đa ${MAX_POST_IMAGES_COUNT} ảnh cho mỗi bài đăng.`,
          },
        ],
      });
    }

    for (const file of files) {
      if (
        !ALLOWED_POST_IMAGE_MIMES.includes(
          file.mimetype as (typeof ALLOWED_POST_IMAGE_MIMES)[number],
        )
      ) {
        throw new HttpException(
          {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message:
              'Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận JPEG, PNG hoặc WebP.',
          },
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        );
      }

      if (file.size <= 0 || file.size > MAX_POST_IMAGE_BYTES) {
        throw new HttpException(
          {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Kích thước mỗi ảnh phải lớn hơn 0 và không vượt quá 10 MB.',
          },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
    }
  }

  private mapImages(images: PostImageRow[]): PostImageDto[] {
    return images.map((img) => ({
      id: img.id,
      url: this.storageService.getPublicUrl(img.storage_key),
      sortOrder: Number(img.sort_order),
    }));
  }

  private buildCreatedPostDetail(
    user: AuthenticatedUser,
    post: PostRow,
    images: PostImageRow[],
  ): PostDetailDto {
    const owner: UserSummaryDto = {
      id: user.id,
      displayName: user.displayName ?? user.schoolEmail,
      verificationStatus: user.verificationStatus,
      reputationScore: user.reputationScore ?? 5.0,
      ...(user.province ? { province: user.province } : {}),
    };

    return {
      id: post.id,
      owner,
      postType: post.post_type,
      title: post.title,
      description: post.description,
      categoryId: post.category_id,
      province: post.province,
      status: post.status,
      images: this.mapImages(images),
      createdAt: this.toIsoString(post.created_at),
      updatedAt: this.toIsoString(post.updated_at),
      ...(post.ended_at ? { endedAt: this.toIsoString(post.ended_at) } : {}),
      ...(post.close_reason !== null ? { closeReason: post.close_reason } : {}),
    };
  }

  private mapPostDetailRow(
    post: PostDetailRow,
    images: PostImageRow[],
  ): PostDetailDto {
    const detail: PostDetailDto = {
      id: post.id,
      owner: {
        id: post.owner_id,
        displayName: post.owner_display_name,
        verificationStatus: post.owner_verification_status,
        reputationScore: Number(post.owner_reputation_score),
        ...(post.owner_province ? { province: post.owner_province } : {}),
      },
      postType: post.post_type,
      title: post.title,
      description: post.description,
      categoryId: post.category_id,
      province: post.province,
      status: post.status,
      images: this.mapImages(images),
      createdAt: this.toIsoString(post.created_at),
      updatedAt: this.toIsoString(post.updated_at),
    };

    if (post.post_type === 'SELL' && post.price !== null && post.condition !== null) {
      detail.sellDetail = {
        price: Number(post.price),
        condition: post.condition,
        allowPhoneReveal: Boolean(post.allow_phone_reveal),
      };
    }

    if (
      post.post_type === 'BUY_REQUEST' &&
      post.budget_min !== null &&
      post.budget_max !== null
    ) {
      detail.buyRequestDetail = {
        budgetMin: Number(post.budget_min),
        budgetMax: Number(post.budget_max),
      };
    }

    if (post.ended_at) {
      detail.endedAt = this.toIsoString(post.ended_at);
    }

    if (post.close_reason !== null) {
      detail.closeReason = post.close_reason;
    }

    return detail;
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
