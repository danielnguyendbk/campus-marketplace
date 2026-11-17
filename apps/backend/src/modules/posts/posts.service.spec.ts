import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { StorageService } from '../../common/storage/storage.service';
import { PostgresService } from '../../database/postgres.service';
import { CategoriesRepository } from '../categories/categories.repository';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';
import { PostRepository } from './repositories/post.repository';

describe('PostsService', () => {
  const verifiedUser: AuthenticatedUser = {
    id: 'user-approved-1',
    schoolEmail: 'sv@ptithcm.edu.vn',
    role: 'USER',
    verificationStatus: 'APPROVED',
    displayName: 'Sinh viên A',
    reputationScore: 5.0,
    province: 'TP. Hồ Chí Minh',
  };

  const validDto: CreatePostDto = {
    postType: 'SELL',
    title: 'Giáo trình Cấu trúc dữ liệu',
    description: 'Sách còn mới 95%, không viết vẽ',
    categoryId: 'TEXTBOOK',
    province: 'TP. Hồ Chí Minh',
    price: 95000,
    condition: 'Như mới',
    allowPhoneReveal: true,
  };

  const validFile = {
    originalname: 'book.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('jpg-data'),
  } as Express.Multer.File;

  const withTransactionMock = jest.fn(async (cb: (client: unknown) => Promise<unknown>) =>
    cb({}),
  );
  const postgresMock = {
    withTransaction: withTransactionMock,
  } as unknown as PostgresService;

  const insertPostMock = jest.fn();
  const insertSellDetailsMock = jest.fn();
  const insertPostImagesMock = jest.fn();
  const findPostDetailByIdMock = jest.fn();
  const findMyPostsPaginatedMock = jest.fn();
  const postRepoMock = {
    insertPost: insertPostMock,
    insertSellDetails: insertSellDetailsMock,
    insertPostImages: insertPostImagesMock,
    findPostDetailById: findPostDetailByIdMock,
    findMyPostsPaginated: findMyPostsPaginatedMock,
  } as unknown as PostRepository;

  const findActiveByIdMock = jest.fn();
  const categoriesRepoMock = {
    findActiveById: findActiveByIdMock,
  } as unknown as CategoriesRepository;

  const savePostImageMock = jest.fn();
  const getPublicUrlMock = jest.fn(
    (key: string) => `http://localhost:4000/uploads/${key}`,
  );
  const storageMock = {
    savePostImage: savePostImageMock,
    getPublicUrl: getPublicUrlMock,
  } as unknown as StorageService;

  const service = new PostsService(
    postgresMock,
    postRepoMock,
    categoriesRepoMock,
    storageMock,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects SELL post creation with 400 when no images are uploaded', async () => {
    await expect(
      service.createSellPost(verifiedUser, validDto, []),
    ).rejects.toThrow(BadRequestException);
    expect(withTransactionMock).not.toHaveBeenCalled();
  });

  it('rejects SELL post creation with 400 when more than 5 images are uploaded', async () => {
    const sixFiles = Array.from({ length: 6 }, () => validFile);
    await expect(
      service.createSellPost(verifiedUser, validDto, sixFiles),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unsupported mime type with 415', async () => {
    const badFile = { ...validFile, mimetype: 'text/plain' };
    await expect(
      service.createSellPost(verifiedUser, validDto, [badFile]),
    ).rejects.toMatchObject({ status: 415 });
  });

  it('rejects oversized image (>10MB) with 413', async () => {
    const largeFile = { ...validFile, size: 10 * 1024 * 1024 + 1 };
    await expect(
      service.createSellPost(verifiedUser, validDto, [largeFile]),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('rejects unknown or inactive categoryId with 400', async () => {
    findActiveByIdMock.mockResolvedValueOnce(null);
    await expect(
      service.createSellPost(verifiedUser, validDto, [validFile]),
    ).rejects.toThrow(BadRequestException);
    expect(withTransactionMock).not.toHaveBeenCalled();
  });

  it('creates SELL post atomically and returns OpenAPI-compliant PostDetailDto', async () => {
    findActiveByIdMock.mockResolvedValueOnce({
      id: 'TEXTBOOK',
      name: 'Sách và giáo trình',
      slug: 'textbooks',
      sort_order: 1,
    });
    insertPostMock.mockResolvedValueOnce({
      id: 'post-uuid-1',
      owner_id: verifiedUser.id,
      post_type: 'SELL',
      title: validDto.title,
      description: validDto.description,
      category_id: 'TEXTBOOK',
      province: validDto.province,
      status: 'ACTIVE',
      close_reason: null,
      ended_at: null,
      created_at: new Date('2026-11-17T06:00:00Z'),
      updated_at: new Date('2026-11-17T06:00:00Z'),
    });
    insertSellDetailsMock.mockResolvedValueOnce({
      post_id: 'post-uuid-1',
      price: '95000.00',
      condition: 'Như mới',
      allow_phone_reveal: true,
    });
    savePostImageMock.mockResolvedValueOnce('posts/post-uuid-1/0-img.jpg');
    insertPostImagesMock.mockResolvedValueOnce([
      {
        id: 'img-uuid-1',
        post_id: 'post-uuid-1',
        storage_key: 'posts/post-uuid-1/0-img.jpg',
        sort_order: 0,
      },
    ]);

    const result = await service.createSellPost(verifiedUser, validDto, [validFile]);

    expect(withTransactionMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: 'post-uuid-1',
      owner: {
        id: verifiedUser.id,
        displayName: 'Sinh viên A',
        verificationStatus: 'APPROVED',
        reputationScore: 5,
        province: 'TP. Hồ Chí Minh',
      },
      postType: 'SELL',
      title: validDto.title,
      description: validDto.description,
      categoryId: 'TEXTBOOK',
      province: 'TP. Hồ Chí Minh',
      status: 'ACTIVE',
      sellDetail: {
        price: 95000,
        condition: 'Như mới',
        allowPhoneReveal: true,
      },
      images: [
        {
          id: 'img-uuid-1',
          url: 'http://localhost:4000/uploads/posts/post-uuid-1/0-img.jpg',
          sortOrder: 0,
        },
      ],
      createdAt: '2026-11-17T06:00:00.000Z',
      updatedAt: '2026-11-17T06:00:00.000Z',
    });
    expect(JSON.stringify(result)).not.toContain('storageKey');
    expect(JSON.stringify(result)).not.toContain('schoolEmail');
  });

  it('throws 404 when getPostById does not find post', async () => {
    findPostDetailByIdMock.mockResolvedValueOnce(null);
    await expect(
      service.getPostById('missing-post', verifiedUser),
    ).rejects.toThrow(NotFoundException);
    expect(HttpException).toBeDefined();
  });
});
