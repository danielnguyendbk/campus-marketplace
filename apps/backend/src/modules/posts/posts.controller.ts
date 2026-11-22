import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthenticatedRequest } from '../../common/auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { VerificationGuard } from '../../common/auth/verification.guard';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { ClosePostDto } from './dto/close-post.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { PostLifecycleService } from './post-lifecycle.service';
import { PostsService } from './posts.service';
import { PhoneRevealDto, PostDetailDto, PostSummaryDto } from './posts.types';

@Controller()
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly postLifecycleService: PostLifecycleService,
  ) {}

  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async createPost(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ): Promise<PostDetailDto> {
    return this.postsService.createPost(req.user!, dto, files);
  }

  @Get('posts/:id')
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async getPostById(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException({
            code: 'VALIDATION_FAILED',
            message: 'ID bài đăng không đúng định dạng UUID.',
            details: [{ field: 'id', message: 'id phải là UUID hợp lệ.' }],
          }),
      }),
    )
    id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PostDetailDto> {
    return this.postsService.getPostById(id, req.user!);
  }

  @Get('me/posts')
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async getMyPosts(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ): Promise<PaginatedResult<PostSummaryDto>> {
    const parsedPage = page !== undefined ? Number(page) : undefined;
    const parsedLimit = limit !== undefined ? Number(limit) : undefined;
    return this.postsService.getMyPosts(
      req.user!,
      parsedPage,
      parsedLimit,
      status,
    );
  }

  @Post('posts/:id/reveal-phone')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async revealSellerPhone(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException({
            code: 'VALIDATION_FAILED',
            message: 'ID bài đăng không đúng định dạng UUID.',
            details: [{ field: 'id', message: 'id phải là UUID hợp lệ.' }],
          }),
      }),
    )
    id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PhoneRevealDto> {
    return this.postsService.revealSellerPhone(id, req.user!);
  }

  @Post('posts/:id/hide')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async hidePost(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException({
            code: 'VALIDATION_FAILED',
            message: 'ID bài đăng không đúng định dạng UUID.',
            details: [{ field: 'id', message: 'id phải là UUID hợp lệ.' }],
          }),
      }),
    )
    id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PostDetailDto> {
    return this.postLifecycleService.hidePost(id, req.user!);
  }

  @Post('posts/:id/activate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async activatePost(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException({
            code: 'VALIDATION_FAILED',
            message: 'ID bài đăng không đúng định dạng UUID.',
            details: [{ field: 'id', message: 'id phải là UUID hợp lệ.' }],
          }),
      }),
    )
    id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PostDetailDto> {
    return this.postLifecycleService.activatePost(id, req.user!);
  }

  @Post('posts/:id/sold')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async markPostSold(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException({
            code: 'VALIDATION_FAILED',
            message: 'ID bài đăng không đúng định dạng UUID.',
            details: [{ field: 'id', message: 'id phải là UUID hợp lệ.' }],
          }),
      }),
    )
    id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PostDetailDto> {
    return this.postLifecycleService.markPostSold(id, req.user!);
  }

  @Post('posts/:id/close')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async closePost(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException({
            code: 'VALIDATION_FAILED',
            message: 'ID bài đăng không đúng định dạng UUID.',
            details: [{ field: 'id', message: 'id phải là UUID hợp lệ.' }],
          }),
      }),
    )
    id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ClosePostDto,
  ): Promise<PostDetailDto> {
    return this.postLifecycleService.closePost(id, req.user!, dto);
  }
}
