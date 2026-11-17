import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { ConversationDto, UserSummaryDto } from './chat.types';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { ConversationRepository } from './repositories/conversation.repository';

@Injectable()
export class ChatService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

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
}
