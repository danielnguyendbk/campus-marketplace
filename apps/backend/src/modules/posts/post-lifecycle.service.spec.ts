import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { PostLifecycleService } from './post-lifecycle.service';
import { PostsService } from './posts.service';
import { PostRepository } from './repositories/post.repository';

describe('PostLifecycleService', () => {
  let service: PostLifecycleService;
  let mockPostRepository: {
    findPostDetailById: jest.Mock;
    updatePostStatus: jest.Mock;
  };
  let mockPostsService: {
    mapPostDetailRow: jest.Mock;
  };

  const ownerUser: AuthenticatedUser = {
    id: 'user-owner',
    schoolEmail: 'owner@ptithcm.edu.vn',
    role: 'USER',
    verificationStatus: 'APPROVED',
  };

  const adminUser: AuthenticatedUser = {
    id: 'user-admin',
    schoolEmail: 'admin@ptithcm.edu.vn',
    role: 'ADMIN',
    verificationStatus: 'APPROVED',
  };

  const strangerUser: AuthenticatedUser = {
    id: 'user-stranger',
    schoolEmail: 'stranger@ptithcm.edu.vn',
    role: 'USER',
    verificationStatus: 'APPROVED',
  };

  const mockActiveSellPostDetail = {
    post: {
      id: 'post-1',
      owner_id: 'user-owner',
      post_type: 'SELL',
      title: 'Giáo trình Giải tích 1',
      description: 'Sách mới 99%',
      category_id: 'TEXTBOOK',
      province: 'Hồ Chí Minh',
      status: 'ACTIVE',
      close_reason: null,
      ended_at: null,
      created_at: new Date('2026-11-01T08:00:00Z'),
      updated_at: new Date('2026-11-01T08:00:00Z'),
      owner_display_name: 'Owner',
      owner_verification_status: 'APPROVED',
      owner_reputation_score: 5.0,
      owner_province: 'Hồ Chí Minh',
      price: 50000,
      condition: 'LIKE_NEW',
      allow_phone_reveal: true,
      budget_min: null,
      budget_max: null,
    },
    images: [],
  };

  beforeEach(async () => {
    mockPostRepository = {
      findPostDetailById: jest.fn(),
      updatePostStatus: jest.fn(),
    };

    mockPostsService = {
      mapPostDetailRow: jest.fn().mockImplementation((post) => ({
        id: post.id,
        status: post.status,
        closeReason: post.close_reason,
        endedAt: post.ended_at ? new Date(post.ended_at).toISOString() : undefined,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostLifecycleService,
        { provide: PostRepository, useValue: mockPostRepository },
        { provide: PostsService, useValue: mockPostsService },
      ],
    }).compile();

    service = module.get<PostLifecycleService>(PostLifecycleService);
  });

  describe('hidePost', () => {
    it('successfully hides an ACTIVE post for the owner', async () => {
      mockPostRepository.findPostDetailById
        .mockResolvedValueOnce(mockActiveSellPostDetail)
        .mockResolvedValueOnce({
          ...mockActiveSellPostDetail,
          post: { ...mockActiveSellPostDetail.post, status: 'HIDDEN' },
        });
      mockPostRepository.updatePostStatus.mockResolvedValueOnce({});

      const result = await service.hidePost('post-1', ownerUser);

      expect(mockPostRepository.updatePostStatus).toHaveBeenCalledWith('post-1', 'HIDDEN');
      expect(result.status).toBe('HIDDEN');
    });

    it('successfully hides an ACTIVE post for an ADMIN', async () => {
      mockPostRepository.findPostDetailById
        .mockResolvedValueOnce(mockActiveSellPostDetail)
        .mockResolvedValueOnce({
          ...mockActiveSellPostDetail,
          post: { ...mockActiveSellPostDetail.post, status: 'HIDDEN' },
        });

      const result = await service.hidePost('post-1', adminUser);
      expect(result.status).toBe('HIDDEN');
    });

    it('throws NotFoundException when post does not exist', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce(null);

      await expect(service.hidePost('non-existent', ownerUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when caller is not the owner or admin', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce(mockActiveSellPostDetail);

      await expect(service.hidePost('post-1', strangerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException when post is already HIDDEN', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce({
        ...mockActiveSellPostDetail,
        post: { ...mockActiveSellPostDetail.post, status: 'HIDDEN' },
      });

      await expect(service.hidePost('post-1', ownerUser)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when post is SOLD or CLOSED', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce({
        ...mockActiveSellPostDetail,
        post: { ...mockActiveSellPostDetail.post, status: 'SOLD' },
      });

      await expect(service.hidePost('post-1', ownerUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('activatePost', () => {
    it('successfully activates a HIDDEN post for the owner', async () => {
      mockPostRepository.findPostDetailById
        .mockResolvedValueOnce({
          ...mockActiveSellPostDetail,
          post: { ...mockActiveSellPostDetail.post, status: 'HIDDEN' },
        })
        .mockResolvedValueOnce(mockActiveSellPostDetail);
      mockPostRepository.updatePostStatus.mockResolvedValueOnce({});

      const result = await service.activatePost('post-1', ownerUser);

      expect(mockPostRepository.updatePostStatus).toHaveBeenCalledWith('post-1', 'ACTIVE');
      expect(result.status).toBe('ACTIVE');
    });

    it('throws NotFoundException when post does not exist', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce(null);

      await expect(service.activatePost('non-existent', ownerUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when caller is not the owner or admin', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce({
        ...mockActiveSellPostDetail,
        post: { ...mockActiveSellPostDetail.post, status: 'HIDDEN' },
      });

      await expect(service.activatePost('post-1', strangerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException when post is already ACTIVE', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce(mockActiveSellPostDetail);

      await expect(service.activatePost('post-1', ownerUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when post is SOLD or CLOSED', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce({
        ...mockActiveSellPostDetail,
        post: { ...mockActiveSellPostDetail.post, status: 'CLOSED' },
      });

      await expect(service.activatePost('post-1', ownerUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('markPostSold', () => {
    it('successfully marks an ACTIVE SELL post as SOLD', async () => {
      mockPostRepository.findPostDetailById
        .mockResolvedValueOnce(mockActiveSellPostDetail)
        .mockResolvedValueOnce({
          ...mockActiveSellPostDetail,
          post: {
            ...mockActiveSellPostDetail.post,
            status: 'SOLD',
            ended_at: new Date(),
          },
        });
      mockPostRepository.updatePostStatus.mockResolvedValueOnce({});

      const result = await service.markPostSold('post-1', ownerUser);

      expect(mockPostRepository.updatePostStatus).toHaveBeenCalledWith(
        'post-1',
        'SOLD',
        expect.objectContaining({ endedAt: expect.any(Date) }),
      );
      expect(result.status).toBe('SOLD');
      expect(result.endedAt).toBeDefined();
    });

    it('successfully marks a HIDDEN SELL post as SOLD', async () => {
      mockPostRepository.findPostDetailById
        .mockResolvedValueOnce({
          ...mockActiveSellPostDetail,
          post: { ...mockActiveSellPostDetail.post, status: 'HIDDEN' },
        })
        .mockResolvedValueOnce({
          ...mockActiveSellPostDetail,
          post: {
            ...mockActiveSellPostDetail.post,
            status: 'SOLD',
            ended_at: new Date(),
          },
        });

      const result = await service.markPostSold('post-1', ownerUser);
      expect(result.status).toBe('SOLD');
    });

    it('throws ConflictException when post is a BUY_REQUEST', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce({
        ...mockActiveSellPostDetail,
        post: { ...mockActiveSellPostDetail.post, post_type: 'BUY_REQUEST' },
      });

      await expect(service.markPostSold('post-1', ownerUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when post is already SOLD', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce({
        ...mockActiveSellPostDetail,
        post: { ...mockActiveSellPostDetail.post, status: 'SOLD' },
      });

      await expect(service.markPostSold('post-1', ownerUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when post is CLOSED', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce({
        ...mockActiveSellPostDetail,
        post: { ...mockActiveSellPostDetail.post, status: 'CLOSED' },
      });

      await expect(service.markPostSold('post-1', ownerUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('closePost', () => {
    it('successfully closes an ACTIVE post with reason', async () => {
      mockPostRepository.findPostDetailById
        .mockResolvedValueOnce(mockActiveSellPostDetail)
        .mockResolvedValueOnce({
          ...mockActiveSellPostDetail,
          post: {
            ...mockActiveSellPostDetail.post,
            status: 'CLOSED',
            close_reason: 'Đã tìm được người mua ngoài đời',
            ended_at: new Date(),
          },
        });
      mockPostRepository.updatePostStatus.mockResolvedValueOnce({});

      const result = await service.closePost('post-1', ownerUser, {
        reason: '  Đã tìm được người mua ngoài đời  ',
      });

      expect(mockPostRepository.updatePostStatus).toHaveBeenCalledWith(
        'post-1',
        'CLOSED',
        expect.objectContaining({
          closeReason: 'Đã tìm được người mua ngoài đời',
          endedAt: expect.any(Date),
        }),
      );
      expect(result.status).toBe('CLOSED');
      expect(result.closeReason).toBe('Đã tìm được người mua ngoài đời');
    });

    it('throws BadRequestException when reason is empty or only whitespace', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce(mockActiveSellPostDetail);

      await expect(service.closePost('post-1', ownerUser, { reason: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException when post is already CLOSED', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce({
        ...mockActiveSellPostDetail,
        post: { ...mockActiveSellPostDetail.post, status: 'CLOSED' },
      });

      await expect(
        service.closePost('post-1', ownerUser, { reason: 'Muốn đóng lại' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when post is SOLD', async () => {
      mockPostRepository.findPostDetailById.mockResolvedValueOnce({
        ...mockActiveSellPostDetail,
        post: { ...mockActiveSellPostDetail.post, status: 'SOLD' },
      });

      await expect(
        service.closePost('post-1', ownerUser, { reason: 'Muốn đóng lại' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});

