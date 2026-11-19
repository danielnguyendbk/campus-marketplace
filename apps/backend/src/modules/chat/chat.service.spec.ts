import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { ChatService } from './chat.service';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { ChatAttachmentStorageService } from './services/chat-attachment-storage.service';

describe('ChatService', () => {
  let service: ChatService;
  let convRepoMock: {
    findPostForConversation: jest.Mock;
    upsertConversation: jest.Mock;
    getUsersSummary: jest.Mock;
    findConversationsByUserId: jest.Mock;
  };
  let msgRepoMock: {
    findConversationContext: jest.Mock;
    insertTextMessage: jest.Mock;
    insertAttachmentMessage: jest.Mock;
    findMessagesByConversationId: jest.Mock;
    countMessagesByConversationId: jest.Mock;
    findAttachmentById: jest.Mock;
  };
  let storageMock: {
    isMimeAllowed: jest.Mock;
    saveAttachment: jest.Mock;
    extractFileName: jest.Mock;
    generateDownloadUrl: jest.Mock;
  };

  const buyerUser: AuthenticatedUser = {
    id: 'user-buyer-1',
    schoolEmail: 'buyer@ptithcm.edu.vn',
    role: 'USER',
    verificationStatus: 'APPROVED',
    displayName: 'Người Mua',
    reputationScore: 5.0,
  };

  const outsiderUser: AuthenticatedUser = {
    id: 'user-outsider-9',
    schoolEmail: 'outsider@ptithcm.edu.vn',
    role: 'USER',
    verificationStatus: 'APPROVED',
    displayName: 'Người Ngoài Cuộc',
    reputationScore: 4.0,
  };

  beforeEach(() => {
    convRepoMock = {
      findPostForConversation: jest.fn(),
      upsertConversation: jest.fn(),
      getUsersSummary: jest.fn(),
      findConversationsByUserId: jest.fn(),
    };
    msgRepoMock = {
      findConversationContext: jest.fn(),
      insertTextMessage: jest.fn(),
      insertAttachmentMessage: jest.fn(),
      findMessagesByConversationId: jest.fn(),
      countMessagesByConversationId: jest.fn(),
      findAttachmentById: jest.fn(),
    };
    storageMock = {
      isMimeAllowed: jest.fn().mockReturnValue(true),
      saveAttachment: jest.fn(),
      extractFileName: jest.fn().mockImplementation((k: string) => k.split('_').slice(1).join('_') || 'file.dat'),
      generateDownloadUrl: jest.fn().mockImplementation((c, a) => `/api/v1/conversations/${c}/attachments/${a}/download`),
    };

    service = new ChatService(
      convRepoMock as unknown as ConversationRepository,
      msgRepoMock as unknown as MessageRepository,
      storageMock as unknown as ChatAttachmentStorageService,
    );
  });

  describe('createConversation', () => {
    it('creates a new conversation successfully', async () => {
      convRepoMock.findPostForConversation.mockResolvedValueOnce({
        id: 'post-1',
        seller_id: 'user-seller-2',
        post_type: 'SELL',
        status: 'ACTIVE',
        seller_verification_status: 'APPROVED',
      });
      convRepoMock.upsertConversation.mockResolvedValueOnce({
        id: 'conv-1',
        post_id: 'post-1',
        member_low_id: 'user-buyer-1',
        member_high_id: 'user-seller-2',
        status: 'OPEN',
        last_message_at: null,
        created_at: new Date('2026-11-17T09:00:00Z'),
      });
      convRepoMock.getUsersSummary.mockResolvedValueOnce([
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
      expect(convRepoMock.upsertConversation).toHaveBeenCalledWith(
        'post-1',
        'user-buyer-1',
        'user-seller-2',
      );
    });

    it('throws NotFoundException when post is not found', async () => {
      convRepoMock.findPostForConversation.mockResolvedValueOnce(null);

      await expect(
        service.createConversation(buyerUser, { postId: 'missing-post' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when post is not SELL type', async () => {
      convRepoMock.findPostForConversation.mockResolvedValueOnce({
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
      convRepoMock.findPostForConversation.mockResolvedValueOnce({
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
      convRepoMock.findPostForConversation.mockResolvedValueOnce({
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
      convRepoMock.findConversationsByUserId.mockResolvedValueOnce({
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

  describe('sendMessage', () => {
    const validConvContext = {
      id: 'conv-1',
      postId: 'post-1',
      memberLowId: 'user-buyer-1',
      memberHighId: 'user-seller-2',
      status: 'OPEN',
      postOwnerId: 'user-seller-2',
      postStatus: 'ACTIVE',
      postType: 'SELL',
      memberLowStatus: 'APPROVED',
      memberHighStatus: 'APPROVED',
    };

    it('sends text message successfully', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(validConvContext);
      msgRepoMock.insertTextMessage.mockResolvedValueOnce({
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_id: 'user-buyer-1',
        type: 'TEXT',
        content: 'Chào bạn, sản phẩm còn không?',
        created_at: new Date('2026-11-17T10:00:00Z'),
        expires_at: new Date('2027-02-17T10:00:00Z'),
      });

      const res = await service.sendMessage(buyerUser, 'conv-1', {
        content: 'Chào bạn, sản phẩm còn không?',
      });

      expect(res.id).toBe('msg-1');
      expect(res.type).toBe('TEXT');
      expect(res.content).toBe('Chào bạn, sản phẩm còn không?');
      expect(msgRepoMock.insertTextMessage).toHaveBeenCalledWith(
        'conv-1',
        'user-buyer-1',
        'Chào bạn, sản phẩm còn không?',
      );
    });

    it('throws NotFoundException when conversation does not exist', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(null);

      await expect(
        service.sendMessage(buyerUser, 'non-existent', { content: 'hello' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not member of conversation', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(validConvContext);

      await expect(
        service.sendMessage(outsiderUser, 'conv-1', { content: 'hello' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when conversation is ARCHIVED', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce({
        ...validConvContext,
        status: 'ARCHIVED',
      });

      await expect(
        service.sendMessage(buyerUser, 'conv-1', { content: 'hello' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when post is not ACTIVE', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce({
        ...validConvContext,
        postStatus: 'SOLD',
      });

      await expect(
        service.sendMessage(buyerUser, 'conv-1', { content: 'hello' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when recipient is SUSPENDED', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce({
        ...validConvContext,
        memberHighStatus: 'SUSPENDED',
      });

      await expect(
        service.sendMessage(buyerUser, 'conv-1', { content: 'hello' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when message content is blank', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(validConvContext);

      await expect(
        service.sendMessage(buyerUser, 'conv-1', { content: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listMessages', () => {
    const validConvContext = {
      id: 'conv-1',
      postId: 'post-1',
      memberLowId: 'user-buyer-1',
      memberHighId: 'user-seller-2',
      status: 'OPEN',
      postOwnerId: 'user-seller-2',
      postStatus: 'ACTIVE',
      postType: 'SELL',
      memberLowStatus: 'APPROVED',
      memberHighStatus: 'APPROVED',
    };

    it('returns messages and masks expired content', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(validConvContext);
      msgRepoMock.findMessagesByConversationId.mockResolvedValueOnce([
        {
          id: 'msg-active',
          conversation_id: 'conv-1',
          sender_id: 'user-buyer-1',
          type: 'TEXT',
          content: 'Tin nhắn còn hạn',
          created_at: new Date('2026-11-17T10:00:00Z'),
          expires_at: new Date(Date.now() + 86400000), // 1 day future
        },
        {
          id: 'msg-expired',
          conversation_id: 'conv-1',
          sender_id: 'user-seller-2',
          type: 'TEXT',
          content: 'Tin nhắn bí mật đã quá 3 tháng',
          created_at: new Date('2026-01-01T10:00:00Z'),
          expires_at: new Date('2026-04-01T10:00:00Z'), // in past
        },
      ]);
      msgRepoMock.countMessagesByConversationId.mockResolvedValueOnce(2);

      const res = await service.listMessages(buyerUser, 'conv-1', { page: 1, limit: 20 });

      expect(res.meta.total).toBe(2);
      expect(res.data[0].content).toBe('Tin nhắn còn hạn');
      // Expired text content is strictly masked to null
      expect(res.data[1].content).toBeNull();
    });

    it('marks expired attachment status and downloadUrl to null', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(validConvContext);
      msgRepoMock.findMessagesByConversationId.mockResolvedValueOnce([
        {
          id: 'msg-att-expired',
          conversation_id: 'conv-1',
          sender_id: 'user-seller-2',
          type: 'ATTACHMENT',
          content: null,
          created_at: new Date('2026-01-01T10:00:00Z'),
          expires_at: new Date('2026-02-01T10:00:00Z'), // expired
          attachment_id: 'att-1',
          attachment_storage_key: 'attachments/conv-1/uuid_hoso.pdf',
          attachment_mime_type: 'application/pdf',
          attachment_size_bytes: 102400,
          attachment_expires_at: new Date('2026-02-01T10:00:00Z'),
          attachment_status: 'ACTIVE',
        },
      ]);
      msgRepoMock.countMessagesByConversationId.mockResolvedValueOnce(1);

      const res = await service.listMessages(buyerUser, 'conv-1', {});

      expect(res.data[0].attachment).toBeDefined();
      expect(res.data[0].attachment?.status).toBe('EXPIRED');
      expect(res.data[0].attachment?.downloadUrl).toBeNull();
      expect(res.data[0].attachment?.fileName).toBe('hoso.pdf');
    });

    it('throws ForbiddenException when outsider tries to view messages', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(validConvContext);

      await expect(
        service.listMessages(outsiderUser, 'conv-1', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('sendAttachment', () => {
    const validConvContext = {
      id: 'conv-1',
      postId: 'post-1',
      memberLowId: 'user-buyer-1',
      memberHighId: 'user-seller-2',
      status: 'OPEN',
      postOwnerId: 'user-seller-2',
      postStatus: 'ACTIVE',
      postType: 'SELL',
      memberLowStatus: 'APPROVED',
      memberHighStatus: 'APPROVED',
    };

    it('saves attachment and inserts message successfully', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(validConvContext);
      storageMock.saveAttachment.mockResolvedValueOnce({
        storageKey: 'attachments/conv-1/uuid_tailieu.pdf',
        fileName: 'tailieu.pdf',
        sizeBytes: 102400,
        mimeType: 'application/pdf',
      });
      msgRepoMock.insertAttachmentMessage.mockResolvedValueOnce({
        message: {
          id: 'msg-att-1',
          conversation_id: 'conv-1',
          sender_id: 'user-buyer-1',
          type: 'ATTACHMENT',
          content: null,
          created_at: new Date('2026-11-17T10:00:00Z'),
          expires_at: new Date('2026-12-17T10:00:00Z'),
        },
        attachment: {
          id: 'att-1',
          message_id: 'msg-att-1',
          storage_key: 'attachments/conv-1/uuid_tailieu.pdf',
          mime_type: 'application/pdf',
          size_bytes: 102400,
          expires_at: new Date('2026-12-17T10:00:00Z'),
          status: 'ACTIVE',
        },
      });

      const mockFile = {
        buffer: Buffer.from('PDF_CONTENT'),
        originalname: 'tailieu.pdf',
        mimetype: 'application/pdf',
        size: 102400,
      } as Express.Multer.File;

      const res = await service.sendAttachment(buyerUser, 'conv-1', mockFile);

      expect(res.id).toBe('msg-att-1');
      expect(res.type).toBe('ATTACHMENT');
      expect(res.content).toBeNull();
      expect(res.attachment).toBeDefined();
      expect(res.attachment?.id).toBe('att-1');
      expect(res.attachment?.fileName).toBe('tailieu.pdf');
      expect(res.attachment?.status).toBe('ACTIVE');
      expect(res.attachment?.downloadUrl).toBe(
        '/api/v1/conversations/conv-1/attachments/att-1/download',
      );
    });

    it('throws BadRequestException when no file is provided', async () => {
      await expect(
        service.sendAttachment(buyerUser, 'conv-1', undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnsupportedMediaTypeException for disallowed mime type', async () => {
      storageMock.isMimeAllowed.mockReturnValueOnce(false);
      const mockFile = {
        buffer: Buffer.from('MZ_EXE_HEADER'),
        originalname: 'malware.exe',
        mimetype: 'application/x-msdownload',
        size: 50000,
      } as Express.Multer.File;

      await expect(
        service.sendAttachment(buyerUser, 'conv-1', mockFile),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('throws PayloadTooLargeException for file larger than 10MB', async () => {
      const mockFile = {
        buffer: Buffer.alloc(11 * 1024 * 1024),
        originalname: 'big_video.mp4',
        mimetype: 'video/mp4',
        size: 11 * 1024 * 1024,
      } as Express.Multer.File;

      await expect(
        service.sendAttachment(buyerUser, 'conv-1', mockFile),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('throws ForbiddenException when outsider tries to upload attachment', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(validConvContext);
      const mockFile = {
        buffer: Buffer.from('PDF_CONTENT'),
        originalname: 'tailieu.pdf',
        mimetype: 'application/pdf',
        size: 102400,
      } as Express.Multer.File;

      await expect(
        service.sendAttachment(outsiderUser, 'conv-1', mockFile),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAttachmentDownload', () => {
    const validConvContext = {
      id: 'conv-1',
      postId: 'post-1',
      memberLowId: 'user-buyer-1',
      memberHighId: 'user-seller-2',
      status: 'OPEN',
      postOwnerId: 'user-seller-2',
      postStatus: 'ACTIVE',
      postType: 'SELL',
      memberLowStatus: 'APPROVED',
      memberHighStatus: 'APPROVED',
    };

    it('returns download metadata for active attachment', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(validConvContext);
      msgRepoMock.findAttachmentById.mockResolvedValueOnce({
        id: 'att-1',
        message_id: 'msg-1',
        storage_key: 'attachments/conv-1/uuid_tailieu.pdf',
        mime_type: 'application/pdf',
        size_bytes: 102400,
        expires_at: new Date(Date.now() + 86400000), // active
        status: 'ACTIVE',
        conversation_id: 'conv-1',
      });

      const res = await service.getAttachmentDownload(buyerUser, 'conv-1', 'att-1');

      expect(res.id).toBe('att-1');
      expect(res.fileName).toBe('tailieu.pdf');
      expect(res.status).toBe('ACTIVE');
      expect(res.downloadUrl).toBe('/api/v1/conversations/conv-1/attachments/att-1/download');
    });

    it('throws NotFoundException when attachment does not exist', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(validConvContext);
      msgRepoMock.findAttachmentById.mockResolvedValueOnce(null);

      await expect(
        service.getAttachmentDownload(buyerUser, 'conv-1', 'missing-att'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when attachment has expired (1 month TTL)', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(validConvContext);
      msgRepoMock.findAttachmentById.mockResolvedValueOnce({
        id: 'att-1',
        message_id: 'msg-1',
        storage_key: 'attachments/conv-1/uuid_tailieu.pdf',
        mime_type: 'application/pdf',
        size_bytes: 102400,
        expires_at: new Date('2026-01-01T00:00:00Z'), // expired in past
        status: 'ACTIVE',
        conversation_id: 'conv-1',
      });

      await expect(
        service.getAttachmentDownload(buyerUser, 'conv-1', 'att-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when non-member tries to download attachment', async () => {
      msgRepoMock.findConversationContext.mockResolvedValueOnce(validConvContext);

      await expect(
        service.getAttachmentDownload(outsiderUser, 'conv-1', 'att-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
