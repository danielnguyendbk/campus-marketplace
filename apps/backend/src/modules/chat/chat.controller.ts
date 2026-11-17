import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest, JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { VerificationGuard } from '../../common/auth/verification.guard';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { ChatService } from './chat.service';
import { ConversationDto } from './chat.types';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';

@Controller('conversations')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async createConversation(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationDto> {
    return this.chatService.createConversation(req.user!, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async listConversations(
    @Req() req: AuthenticatedRequest,
    @Query() dto: ListConversationsDto,
  ): Promise<PaginatedResult<ConversationDto>> {
    return this.chatService.listConversations(req.user!, dto);
  }
}
