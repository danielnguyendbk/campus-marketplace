import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { ChatService } from './chat.service';
import { ConversationRepository } from './repositories/conversation.repository';

describe('ChatService', () => {
  let service: ChatService;
  let repoMock: {
    findPostForConversation: jest.Mock;
    upsertConversation: jest.Mock;
    getUsersSummary: jest.Mock;
    findConversationsByUserId: jest.Mock;
  };

  const buyerUser: AuthenticatedUser = {
    id: 'user-buyer-1',
    schoolEmail: 'buyer@ptithcm.edu.vn',
    role: 'USER',
    verificationStatus: 'APPROVED',
    displayName: 'Người Mua',
    reputationScore: 5.0,
  };

  beforeEach(() => {
    repoMock = {
      findPostForConversation: jest.fn(),
      upsertConversation: jest.fn(),
      getUsersSummary: jest.fn(),
      findConversationsByUserId: jest.fn(),
    };
    service = new ChatService(repoMock as unknown as ConversationRepository);
  });

  describe('createConversation', () => {
    it('creates a new conversation successfully', async () => {
      repoMock.findPostForConversation.mockResolvedValueOnce({
        id: 'post-1',
        seller_id: 'user-seller-2',
        post_type: 'SELL',
        status: 'ACTIVE',
        seller_verification_status: 'APPROVED',
      });
      repoMock.upsertConversation.mockResolvedValueOnce({
        id: 'conv-1',
        post_id: 'post-1',
        member_low_id: 'user-buyer-1',
        member_high_id: 'user-seller-2',
        status: 'OPEN',
        last_message_at: null,
        created_at: new Date('2026-11-17T09:00:00Z'),
      });
      repoMock.getUsersSummary.mockResolvedValueOnce([
        {
          id: 'user-buyer-1',
          displayName: 'Người Mua',
          verificationStatus: 'APPROVED',
          reputationScore: 5.0,
        },
        {
          id: 'user-seller-2',
          displayName: 'Người Bán',
          verificationStatus: 'APPROVED',
          reputationScore: 4.9,
        },
      ]);

      const res = await service.createConversation(buyerUser, { postId: 'post-1' });

      expect(res.id).toBe('conv-1');
      expect(res.postId).toBe('post-1');
      expect(res.status).toBe('OPEN');
      expect(res.canSend).toBe(true);
      expect(res.members).toHaveLength(2);
      expect(repoMock.upsertConversation).toHaveBeenCalledWith(
        'post-1',
        'user-buyer-1',
        'user-seller-2',
      );
    });

    it('throws NotFoundException when post is not found', async () => {
      repoMock.findPostForConversation.mockResolvedValueOnce(null);

      await expect(
        service.createConversation(buyerUser, { postId: 'missing-post' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when post is not SELL type', async () => {
      repoMock.findPostForConversation.mockResolvedValueOnce({
        id: 'post-1',
        seller_id: 'user-seller-2',
        post_type: 'BUY_REQUEST',
        status: 'ACTIVE',
        seller_verification_status: 'APPROVED',
      });

      await expect(
        service.createConversation(buyerUser, { postId: 'post-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when post is not ACTIVE', async () => {
      repoMock.findPostForConversation.mockResolvedValueOnce({
        id: 'post-1',
        seller_id: 'user-seller-2',
        post_type: 'SELL',
        status: 'SOLD',
        seller_verification_status: 'APPROVED',
      });

      await expect(
        service.createConversation(buyerUser, { postId: 'post-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when user tries to chat with self', async () => {
      repoMock.findPostForConversation.mockResolvedValueOnce({
        id: 'post-1',
        seller_id: buyerUser.id,
        post_type: 'SELL',
        status: 'ACTIVE',
        seller_verification_status: 'APPROVED',
      });

      await expect(
        service.createConversation(buyerUser, { postId: 'post-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listConversations', () => {
    it('returns paginated conversations with canSend computed', async () => {
      repoMock.findConversationsByUserId.mockResolvedValueOnce({
        total: 1,
        rows: [
          {
            id: 'conv-1',
            post_id: 'post-1',
            member_low_id: 'user-buyer-1',
            member_high_id: 'user-seller-2',
            status: 'OPEN',
            last_message_at: new Date('2026-11-17T09:30:00Z'),
            created_at: new Date('2026-11-17T09:00:00Z'),
            post_status: 'ACTIVE',
            post_type: 'SELL',
            low_id: 'user-buyer-1',
            low_display_name: 'Người Mua',
            low_verification_status: 'APPROVED',
            low_reputation_score: '5.00',
            low_province: 'TP. Hồ Chí Minh',
            high_id: 'user-seller-2',
            high_display_name: 'Người Bán',
            high_verification_status: 'APPROVED',
            high_reputation_score: '4.90',
            high_province: 'Hà Nội',
          },
        ],
      });

      const res = await service.listConversations(buyerUser, { page: 1, limit: 10 });

      expect(res.meta.total).toBe(1);
      expect(res.meta.page).toBe(1);
      expect(res.meta.totalPages).toBe(1);
      expect(res.data).toHaveLength(1);
      expect(res.data[0].canSend).toBe(true);
      expect(res.data[0].members).toHaveLength(2);
      expect(res.data[0].lastMessageAt).toBe('2026-11-17T09:30:00.000Z');
    });
  });
});
