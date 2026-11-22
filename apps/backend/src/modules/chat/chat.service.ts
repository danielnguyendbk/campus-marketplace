import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import {
  AttachmentDto,
  ConversationDto,
  MessageDto,
  UserSummaryDto,
} from './chat.types';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import {
  ChatAttachmentStorageService,
  CHAT_ATTACHMENT_MAX_SIZE,
} from './services/chat-attachment-storage.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly chatAttachmentStorageService: ChatAttachmentStorageService,
  ) { }

  async createConversation(
    buyer: AuthenticatedUser,
    dto: CreateConversationDto,
  ): Promise<ConversationDto> {
    const post = await this.conversationRepository.findPostForConversation(dto.postId);
    if (!post) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Không tìm thấy bài đăng.',
      });
    }

    if (post.post_type !== 'SELL') {
      throw new ConflictException({
        code: 'INVALID_POST_TYPE',
        message: 'Tính năng chat chỉ áp dụng cho tin đăng bán (SELL).',
      });
    }

    if (post.status !== 'ACTIVE') {
      throw new ConflictException({
        code: 'POST_NOT_ACTIVE',
        message: 'Bài đăng không còn ở trạng thái hoạt động.',
      });
    }

    if (buyer.id === post.seller_id) {
      throw new BadRequestException({
        code: 'SELF_CONVERSATION_NOT_ALLOWED',
        message: 'Bạn không thể mở cuộc trò chuyện với chính mình.',
      });
    }

    const [memberLowId, memberHighId] =
      buyer.id < post.seller_id
        ? [buyer.id, post.seller_id]
        : [post.seller_id, buyer.id];

    const conv = await this.conversationRepository.upsertConversation(
      dto.postId,
      memberLowId,
      memberHighId,
    );

    const members = await this.conversationRepository.getUsersSummary([
      buyer.id,
      post.seller_id,
    ]);

    const canSend =
      conv.status === 'OPEN' &&
      post.status === 'ACTIVE' &&
      buyer.verificationStatus === 'APPROVED' &&
      post.seller_verification_status !== 'SUSPENDED';

    return {
      id: conv.id,
      postId: conv.post_id,
      status: conv.status,
      members,
      lastMessageAt: conv.last_message_at
        ? new Date(conv.last_message_at).toISOString()
        : undefined,
      createdAt: new Date(conv.created_at).toISOString(),
      canSend,
    };
  }

  async listConversations(
    user: AuthenticatedUser,
    dto: ListConversationsDto,
  ): Promise<PaginatedResult<ConversationDto>> {
    const page = dto.page && dto.page >= 1 ? Number(dto.page) : 1;
    const limit = dto.limit && dto.limit >= 1 ? Number(dto.limit) : 20;

    const { rows, total } = await this.conversationRepository.findConversationsByUserId(
      user.id,
      page,
      limit,
    );

    const data: ConversationDto[] = rows.map((r) => {
      const lowMember: UserSummaryDto = {
        id: r.low_id,
        displayName: r.low_display_name,
        verificationStatus: r.low_verification_status,
        reputationScore: Number(r.low_reputation_score),
        province: r.low_province ?? undefined,
      };
      const highMember: UserSummaryDto = {
        id: r.high_id,
        displayName: r.high_display_name,
        verificationStatus: r.high_verification_status,
        reputationScore: Number(r.high_reputation_score),
        province: r.high_province ?? undefined,
      };

      const canSend =
        r.status === 'OPEN' &&
        r.post_status === 'ACTIVE' &&
        r.low_verification_status !== 'SUSPENDED' &&
        r.high_verification_status !== 'SUSPENDED';

      return {
        id: r.id,
        postId: r.post_id,
        status: r.status,
        members: [lowMember, highMember],
        lastMessageAt: r.last_message_at
          ? new Date(r.last_message_at).toISOString()
          : undefined,
        createdAt: new Date(r.created_at).toISOString(),
        canSend,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async sendMessage(
    currentUser: AuthenticatedUser,
    conversationId: string,
    dto: CreateMessageDto,
  ): Promise<MessageDto> {
    const conv = await this.messageRepository.findConversationContext(conversationId);
    if (!conv) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Không tìm thấy cuộc trò chuyện.',
      });
    }

    const isMember =
      currentUser.id === conv.memberLowId || currentUser.id === conv.memberHighId;
    if (!isMember) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không phải là thành viên của cuộc trò chuyện này.',
      });
    }

    if (conv.status !== 'OPEN') {
      throw new ConflictException({
        code: 'CONVERSATION_CLOSED',
        message: 'Cuộc trò chuyện đã bị đóng hoặc lưu trữ.',
      });
    }

    if (conv.postStatus !== 'ACTIVE') {
      throw new ConflictException({
        code: 'POST_NOT_ACTIVE',
        message: 'Bài đăng không còn ở trạng thái hoạt động.',
      });
    }

    const otherMemberStatus =
      currentUser.id === conv.memberLowId
        ? conv.memberHighStatus
        : conv.memberLowStatus;
    if (otherMemberStatus === 'SUSPENDED') {
      throw new ConflictException({
        code: 'RECIPIENT_SUSPENDED',
        message: 'Tài khoản người nhận hiện đang bị tạm khóa.',
      });
    }

    const trimmedContent = dto.content.trim();
    if (!trimmedContent) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Nội dung tin nhắn không được để trống.',
        details: [{ field: 'content', message: 'Nội dung tin nhắn không được để trống.' }],
      });
    }

    const msg = await this.messageRepository.insertTextMessage(
      conversationId,
      currentUser.id,
      trimmedContent,
    );

    return {
      id: msg.id,
      conversationId: msg.conversation_id,
      senderId: msg.sender_id,
      type: 'TEXT',
      content: msg.content,
      createdAt: new Date(msg.created_at).toISOString(),
      expiresAt: new Date(msg.expires_at).toISOString(),
    };
  }

  async listMessages(
    currentUser: AuthenticatedUser,
    conversationId: string,
    query: ListMessagesDto,
  ): Promise<PaginatedResult<MessageDto>> {
    const conv = await this.messageRepository.findConversationContext(conversationId);
    if (!conv) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Không tìm thấy cuộc trò chuyện.',
      });
    }

    const isMember =
      currentUser.id === conv.memberLowId || currentUser.id === conv.memberHighId;
    if (!isMember) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không phải là thành viên của cuộc trò chuyện này.',
      });
    }

    const page = query.page && query.page >= 1 ? Number(query.page) : 1;
    const limit = query.limit && query.limit >= 1 ? Number(query.limit) : 20;
    const offset = (page - 1) * limit;

    const rows = await this.messageRepository.findMessagesByConversationId(
      conversationId,
      limit,
      offset,
    );
    const total = await this.messageRepository.countMessagesByConversationId(conversationId);

    const now = new Date();
    const data: MessageDto[] = rows.map((r) => {
      const isMsgExpired = new Date(r.expires_at) <= now;
      let attachmentDto: AttachmentDto | undefined;

      if (r.type === 'ATTACHMENT' && r.attachment_id) {
        const isAttExpired =
          isMsgExpired ||
          (r.attachment_expires_at ? new Date(r.attachment_expires_at) <= now : false);

        const fileName = r.attachment_storage_key
          ? this.chatAttachmentStorageService.extractFileName(r.attachment_storage_key)
          : null;

        attachmentDto = {
          id: r.attachment_id,
          fileName,
          mimeType: r.attachment_mime_type ?? 'application/octet-stream',
          sizeBytes: Number(r.attachment_size_bytes ?? 0),
          status: isAttExpired ? 'EXPIRED' : (r.attachment_status ?? 'ACTIVE'),
          downloadUrl: isAttExpired
            ? null
            : this.chatAttachmentStorageService.generateDownloadUrl(
              conversationId,
              r.attachment_id,
            ),
          expiresAt: new Date(r.attachment_expires_at ?? r.expires_at).toISOString(),
        };
      }

      return {
        id: r.id,
        conversationId: r.conversation_id,
        senderId: r.sender_id,
        type: r.type,
        content: r.type === 'TEXT' ? (isMsgExpired ? null : r.content) : null,
        attachment: attachmentDto,
        createdAt: new Date(r.created_at).toISOString(),
        expiresAt: new Date(r.expires_at).toISOString(),
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async sendAttachment(
    currentUser: AuthenticatedUser,
    conversationId: string,
    file?: Express.Multer.File,
  ): Promise<MessageDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Tệp đính kèm là bắt buộc.',
        details: [{ field: 'file', message: 'Tệp đính kèm là bắt buộc.' }],
      });
    }

    if (!this.chatAttachmentStorageService.isMimeAllowed(file.mimetype)) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message:
          'Định dạng tệp không được hỗ trợ. Vui lòng tải lên tài liệu học tập hoặc hình ảnh hợp lệ.',
      });
    }

    if (file.size > CHAT_ATTACHMENT_MAX_SIZE) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message:
          'Tệp vượt quá giới hạn 10 MB. Vui lòng sử dụng Google Drive hoặc dịch vụ đám mây và chia sẻ liên kết.',
      });
    }

    const conv = await this.messageRepository.findConversationContext(conversationId);
    if (!conv) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Không tìm thấy cuộc trò chuyện.',
      });
    }

    const isMember =
      currentUser.id === conv.memberLowId || currentUser.id === conv.memberHighId;
    if (!isMember) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không phải là thành viên của cuộc trò chuyện này.',
      });
    }

    if (conv.status !== 'OPEN') {
      throw new ConflictException({
        code: 'CONVERSATION_CLOSED',
        message: 'Cuộc trò chuyện đã bị đóng hoặc lưu trữ.',
      });
    }

    if (conv.postStatus !== 'ACTIVE') {
      throw new ConflictException({
        code: 'POST_NOT_ACTIVE',
        message: 'Bài đăng không còn ở trạng thái hoạt động.',
      });
    }

    const otherMemberStatus =
      currentUser.id === conv.memberLowId
        ? conv.memberHighStatus
        : conv.memberLowStatus;
    if (otherMemberStatus === 'SUSPENDED') {
      throw new ConflictException({
        code: 'RECIPIENT_SUSPENDED',
        message: 'Tài khoản người nhận hiện đang bị tạm khóa.',
      });
    }

    const saved = await this.chatAttachmentStorageService.saveAttachment(conversationId, file);

    const { message, attachment } =
      await this.messageRepository.insertAttachmentMessage(
        conversationId,
        currentUser.id,
        saved.storageKey,
        saved.mimeType,
        saved.sizeBytes,
      );

    const downloadUrl = this.chatAttachmentStorageService.generateDownloadUrl(
      conversationId,
      attachment.id,
    );

    return {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      type: 'ATTACHMENT',
      content: null,
      attachment: {
        id: attachment.id,
        fileName: saved.fileName,
        mimeType: attachment.mime_type,
        sizeBytes: Number(attachment.size_bytes),
        status: 'ACTIVE',
        downloadUrl,
        expiresAt: new Date(attachment.expires_at).toISOString(),
      },
      createdAt: new Date(message.created_at).toISOString(),
      expiresAt: new Date(message.expires_at).toISOString(),
    };
  }

  async getAttachmentDownload(
    currentUser: AuthenticatedUser,
    conversationId: string,
    attachmentId: string,
  ): Promise<AttachmentDto> {
    const conv = await this.messageRepository.findConversationContext(conversationId);
    if (!conv) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Không tìm thấy cuộc trò chuyện.',
      });
    }

    const isMember =
      currentUser.id === conv.memberLowId || currentUser.id === conv.memberHighId;
    if (!isMember) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không phải là thành viên của cuộc trò chuyện này.',
      });
    }

    const att = await this.messageRepository.findAttachmentById(conversationId, attachmentId);
    if (!att) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Không tìm thấy tệp đính kèm trong cuộc trò chuyện này.',
      });
    }

    const isExpired =
      new Date(att.expires_at) <= new Date() || att.status === 'EXPIRED';
    if (isExpired) {
      throw new ConflictException({
        code: 'ATTACHMENT_EXPIRED',
        message: 'Tệp đính kèm đã hết hạn lưu trữ (1 tháng).',
      });
    }

    const fileName = this.chatAttachmentStorageService.extractFileName(att.storage_key);

    return {
      id: att.id,
      fileName,
      mimeType: att.mime_type,
      sizeBytes: Number(att.size_bytes),
      status: 'ACTIVE',
      downloadUrl: this.chatAttachmentStorageService.generateDownloadUrl(
        conversationId,
        att.id,
      ),
      expiresAt: new Date(att.expires_at).toISOString(),
    };
  }
}
