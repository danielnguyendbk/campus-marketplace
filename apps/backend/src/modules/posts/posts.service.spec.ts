import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
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

  const validBuyRequestDto: CreatePostDto = {
    postType: 'BUY_REQUEST',
    title: 'Tìm mua giáo trình Java',
    description: 'Cần sách để học học kỳ này',
    categoryId: 'TEXTBOOK',
    province: 'TP. Hồ Chí Minh',
    budgetMin: 100000,
    budgetMax: 150000,
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
  const insertBuyRequestDetailsMock = jest.fn();
  const insertPostImagesMock = jest.fn();
  const findPostDetailByIdMock = jest.fn();
  const findMyPostsPaginatedMock = jest.fn();
  const findPostForPhoneRevealMock = jest.fn();
  const insertPhoneRevealEventMock = jest.fn();
  const postRepoMock = {
    insertPost: insertPostMock,
    insertSellDetails: insertSellDetailsMock,
    insertBuyRequestDetails: insertBuyRequestDetailsMock,
    insertPostImages: insertPostImagesMock,
    findPostDetailById: findPostDetailByIdMock,
    findMyPostsPaginated: findMyPostsPaginatedMock,
    findPostForPhoneReveal: findPostForPhoneRevealMock,
    insertPhoneRevealEvent: insertPhoneRevealEventMock,
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

  const catchError = async (
    promise: Promise<unknown>,
  ): Promise<BadRequestException> => {
    try {
      await promise;
    } catch (err) {
      return err as BadRequestException;
    }
    throw new Error('Expected the request to fail, but it resolved.');
  };

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

  it('creates BUY_REQUEST post without images and returns buyRequestDetail without sellDetail', async () => {
    findActiveByIdMock.mockResolvedValueOnce({
      id: 'TEXTBOOK',
      name: 'Sách và giáo trình',
      slug: 'textbooks',
      sort_order: 1,
    });
    insertPostMock.mockResolvedValueOnce({
      id: 'post-buy-1',
      owner_id: verifiedUser.id,
      post_type: 'BUY_REQUEST',
      title: validBuyRequestDto.title,
      description: validBuyRequestDto.description,
      category_id: 'TEXTBOOK',
      province: validBuyRequestDto.province,
      status: 'ACTIVE',
      close_reason: null,
      ended_at: null,
      created_at: new Date('2026-11-17T07:00:00Z'),
      updated_at: new Date('2026-11-17T07:00:00Z'),
    });
    insertBuyRequestDetailsMock.mockResolvedValueOnce({
      post_id: 'post-buy-1',
      budget_min: '100000.00',
      budget_max: '150000.00',
    });

    const result = await service.createPost(
      verifiedUser,
      validBuyRequestDto,
      [],
    );

    expect(withTransactionMock).toHaveBeenCalledTimes(1);
    expect(insertSellDetailsMock).not.toHaveBeenCalled();
    expect(insertPostImagesMock).not.toHaveBeenCalled();
    expect(insertBuyRequestDetailsMock).toHaveBeenCalledWith(
      { postId: 'post-buy-1', budgetMin: 100000, budgetMax: 150000 },
      expect.anything(),
    );
    expect(result.postType).toBe('BUY_REQUEST');
    expect(result.status).toBe('ACTIVE');
    expect(result.buyRequestDetail).toEqual({
      budgetMin: 100000,
      budgetMax: 150000,
    });
    expect(result.sellDetail).toBeUndefined();
    expect(result.images).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('storageKey');
  });

  it('creates BUY_REQUEST post with optional images attached', async () => {
    findActiveByIdMock.mockResolvedValueOnce({
      id: 'TEXTBOOK',
      name: 'Sách và giáo trình',
      slug: 'textbooks',
      sort_order: 1,
    });
    insertPostMock.mockResolvedValueOnce({
      id: 'post-buy-2',
      owner_id: verifiedUser.id,
      post_type: 'BUY_REQUEST',
      title: validBuyRequestDto.title,
      description: validBuyRequestDto.description,
      category_id: 'TEXTBOOK',
      province: validBuyRequestDto.province,
      status: 'ACTIVE',
      close_reason: null,
      ended_at: null,
      created_at: new Date('2026-11-17T07:10:00Z'),
      updated_at: new Date('2026-11-17T07:10:00Z'),
    });
    insertBuyRequestDetailsMock.mockResolvedValueOnce({
      post_id: 'post-buy-2',
      budget_min: '100000.00',
      budget_max: '150000.00',
    });
    savePostImageMock.mockResolvedValueOnce('posts/post-buy-2/0-ref.jpg');
    insertPostImagesMock.mockResolvedValueOnce([
      {
        id: 'img-buy-1',
        post_id: 'post-buy-2',
        storage_key: 'posts/post-buy-2/0-ref.jpg',
        sort_order: 0,
      },
    ]);

    const result = await service.createPost(
      verifiedUser,
      validBuyRequestDto,
      [validFile],
    );

    expect(savePostImageMock).toHaveBeenCalledTimes(1);
    expect(result.images).toEqual([
      {
        id: 'img-buy-1',
        url: 'http://localhost:4000/uploads/posts/post-buy-2/0-ref.jpg',
        sortOrder: 0,
      },
    ]);
    expect(result.buyRequestDetail).toEqual({
      budgetMin: 100000,
      budgetMax: 150000,
    });
  });

  it('rejects BUY_REQUEST with 400 when budgetMax is lower than budgetMin', async () => {
    const error = await catchError(
      service.createPost(
        verifiedUser,
        { ...validBuyRequestDto, budgetMin: 200000, budgetMax: 100000 },
        [],
      ),
    );

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Ngân sách tối đa phải lớn hơn hoặc bằng ngân sách tối thiểu.',
      details: [
        {
          field: 'budgetMax',
          message: 'budgetMax phải lớn hơn hoặc bằng budgetMin.',
        },
      ],
    });
    expect(withTransactionMock).not.toHaveBeenCalled();
  });

  it('rejects BUY_REQUEST when SELL-only fields (price/condition/allowPhoneReveal) are sent', async () => {
    for (const extra of [
      { price: 120000 },
      { condition: 'Tốt' },
      { allowPhoneReveal: true },
    ]) {
      const error = await catchError(
        service.createPost(verifiedUser, { ...validBuyRequestDto, ...extra }, []),
      );

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({ code: 'VALIDATION_FAILED' });
    }

    const error = await catchError(
      service.createPost(verifiedUser, { ...validBuyRequestDto, price: 120000 }, []),
    );
    expect(
      (error.getResponse() as { details: Array<{ field: string }> }).details[0]
        .field,
    ).toBe('price');
    expect(withTransactionMock).not.toHaveBeenCalled();
  });

  it('rejects SELL post when BUY_REQUEST-only budget fields are sent', async () => {
    const error = await catchError(
      service.createSellPost(
        verifiedUser,
        { ...validDto, budgetMin: 100000, budgetMax: 150000 },
        [validFile],
      ),
    );

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(
      (error.getResponse() as { details: Array<{ field: string }> }).details.map(
        (d) => d.field,
      ),
    ).toEqual(['budgetMin', 'budgetMax']);
    expect(withTransactionMock).not.toHaveBeenCalled();
  });

  it('still defaults allowPhoneReveal to true for SELL when the field is omitted', async () => {
    const dtoWithoutFlag: CreatePostDto = { ...validDto };
    delete dtoWithoutFlag.allowPhoneReveal;
    findActiveByIdMock.mockResolvedValueOnce({
      id: 'TEXTBOOK',
      name: 'Sách và giáo trình',
      slug: 'textbooks',
      sort_order: 1,
    });
    insertPostMock.mockResolvedValueOnce({
      id: 'post-sell-2',
      owner_id: verifiedUser.id,
      post_type: 'SELL',
      title: validDto.title,
      description: validDto.description,
      category_id: 'TEXTBOOK',
      province: validDto.province,
      status: 'ACTIVE',
      close_reason: null,
      ended_at: null,
      created_at: new Date('2026-11-17T07:20:00Z'),
      updated_at: new Date('2026-11-17T07:20:00Z'),
    });
    insertSellDetailsMock.mockResolvedValueOnce({
      post_id: 'post-sell-2',
      price: '95000.00',
      condition: 'Như mới',
      allow_phone_reveal: true,
    });
    savePostImageMock.mockResolvedValueOnce('posts/post-sell-2/0-img.jpg');
    insertPostImagesMock.mockResolvedValueOnce([
      {
        id: 'img-sell-2',
        post_id: 'post-sell-2',
        storage_key: 'posts/post-sell-2/0-img.jpg',
        sort_order: 0,
      },
    ]);

    await service.createPost(verifiedUser, dtoWithoutFlag, [validFile]);

    expect(insertSellDetailsMock).toHaveBeenCalledWith(
      expect.objectContaining({ allowPhoneReveal: true }),
      expect.anything(),
    );
    expect(insertBuyRequestDetailsMock).not.toHaveBeenCalled();
  });

  describe('revealSellerPhone', () => {
    const sellerId = 'seller-user-uuid';
    const otherUser: AuthenticatedUser = {
      id: 'buyer-user-uuid',
      schoolEmail: 'buyer@ptithcm.edu.vn',
      role: 'USER',
      verificationStatus: 'APPROVED',
      displayName: 'Người mua B',
      reputationScore: 5.0,
      province: 'TP. Hồ Chí Minh',
    };

    it('reveals phone number when post is SELL, ACTIVE, and allowPhoneReveal is true', async () => {
      findPostForPhoneRevealMock.mockResolvedValueOnce({
        id: 'post-1',
        seller_id: sellerId,
        post_type: 'SELL',
        status: 'ACTIVE',
        allow_phone_reveal: true,
        phone_number: '0901234567',
      });
      insertPhoneRevealEventMock.mockResolvedValueOnce({
        id: 'event-1',
        viewer_id: otherUser.id,
        post_id: 'post-1',
        seller_id: sellerId,
        revealed_at: new Date('2026-11-17T09:00:00Z'),
      });

      const res = await service.revealSellerPhone('post-1', otherUser);

      expect(res.phoneNumber).toBe('0901234567');
      expect(res.revealedAt).toBe('2026-11-17T09:00:00.000Z');
      expect(insertPhoneRevealEventMock).toHaveBeenCalledWith(
        otherUser.id,
        'post-1',
        sellerId,
      );
    });

    it('returns null phoneNumber when allowPhoneReveal is false but still records event', async () => {
      findPostForPhoneRevealMock.mockResolvedValueOnce({
        id: 'post-1',
        seller_id: sellerId,
        post_type: 'SELL',
        status: 'ACTIVE',
        allow_phone_reveal: false,
        phone_number: '0901234567',
      });
      insertPhoneRevealEventMock.mockResolvedValueOnce({
        id: 'event-1',
        viewer_id: otherUser.id,
        post_id: 'post-1',
        seller_id: sellerId,
        revealed_at: new Date('2026-11-17T09:00:00Z'),
      });

      const res = await service.revealSellerPhone('post-1', otherUser);

      expect(res.phoneNumber).toBeNull();
      expect(res.revealedAt).toBe('2026-11-17T09:00:00.000Z');
      expect(insertPhoneRevealEventMock).toHaveBeenCalledTimes(1);
    });

    it('returns phoneNumber to the owner even if allowPhoneReveal is false', async () => {
      const ownerUser: AuthenticatedUser = {
        ...otherUser,
        id: sellerId,
      };
      findPostForPhoneRevealMock.mockResolvedValueOnce({
        id: 'post-1',
        seller_id: sellerId,
        post_type: 'SELL',
        status: 'ACTIVE',
        allow_phone_reveal: false,
        phone_number: '0901234567',
      });
      insertPhoneRevealEventMock.mockResolvedValueOnce({
        id: 'event-2',
        viewer_id: sellerId,
        post_id: 'post-1',
        seller_id: sellerId,
        revealed_at: new Date('2026-11-17T09:00:00Z'),
      });

      const res = await service.revealSellerPhone('post-1', ownerUser);

      expect(res.phoneNumber).toBe('0901234567');
      expect(res.revealedAt).toBe('2026-11-17T09:00:00.000Z');
    });

    it('throws NotFoundException when post does not exist', async () => {
      findPostForPhoneRevealMock.mockResolvedValueOnce(null);

      const err = await catchError(
        service.revealSellerPhone('missing-post', otherUser),
      );

      expect(err).toBeInstanceOf(NotFoundException);
      expect((err?.getResponse() as Record<string, unknown>)?.code).toBe(
        'POST_NOT_FOUND',
      );
    });

    it('throws ConflictException when post_type is BUY_REQUEST', async () => {
      findPostForPhoneRevealMock.mockResolvedValueOnce({
        id: 'post-buy-1',
        seller_id: sellerId,
        post_type: 'BUY_REQUEST',
        status: 'ACTIVE',
        allow_phone_reveal: null,
        phone_number: '0901234567',
      });

      const err = await catchError(
        service.revealSellerPhone('post-buy-1', otherUser),
      );

      expect(err).toBeInstanceOf(ConflictException);
      expect((err?.getResponse() as Record<string, unknown>)?.code).toBe(
        'INVALID_POST_TYPE',
      );
    });

    it('throws ConflictException when post is SOLD or CLOSED', async () => {
      findPostForPhoneRevealMock.mockResolvedValueOnce({
        id: 'post-sold-1',
        seller_id: sellerId,
        post_type: 'SELL',
        status: 'SOLD',
        allow_phone_reveal: true,
        phone_number: '0901234567',
      });

      const err = await catchError(
        service.revealSellerPhone('post-sold-1', otherUser),
      );

      expect(err).toBeInstanceOf(ConflictException);
      expect((err?.getResponse() as Record<string, unknown>)?.code).toBe(
        'POST_NOT_ACTIVE',
      );
    });

    it('throws NotFoundException when post is HIDDEN and viewer is neither owner nor admin', async () => {
      findPostForPhoneRevealMock.mockResolvedValueOnce({
        id: 'post-hidden-1',
        seller_id: sellerId,
        post_type: 'SELL',
        status: 'HIDDEN',
        allow_phone_reveal: true,
        phone_number: '0901234567',
      });

      const err = await catchError(
        service.revealSellerPhone('post-hidden-1', otherUser),
      );

      expect(err).toBeInstanceOf(NotFoundException);
      expect((err?.getResponse() as Record<string, unknown>)?.code).toBe(
        'POST_NOT_FOUND',
      );
    });
  });
});
