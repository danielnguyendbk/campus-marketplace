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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedRequest, JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { VerificationGuard } from '../../common/auth/verification.guard';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { ChatService } from './chat.service';
import {
  AttachmentDto,
  ConversationDto,
  MessageDto,
} from './chat.types';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { ListMessagesDto } from './dto/list-messages.dto';

const parseUuidPipe = (fieldName: string) =>
  new ParseUUIDPipe({
    version: '4',
    exceptionFactory: () =>
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: `${fieldName} không hợp lệ.`,
        details: [{ field: fieldName, message: `${fieldName} phải là UUID hợp lệ.` }],
      }),
  });

@Controller('conversations')
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

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

  @Get(':conversationId/messages')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async listMessages(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId', parseUuidPipe('conversationId')) conversationId: string,
    @Query() query: ListMessagesDto,
  ): Promise<PaginatedResult<MessageDto>> {
    return this.chatService.listMessages(req.user!, conversationId, query);
  }

  @Post(':conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async sendTextMessage(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId', parseUuidPipe('conversationId')) conversationId: string,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageDto> {
    return this.chatService.sendMessage(req.user!, conversationId, dto);
  }

  @Post(':conversationId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async sendAttachment(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId', parseUuidPipe('conversationId')) conversationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MessageDto> {
    return this.chatService.sendAttachment(req.user!, conversationId, file);
  }

  @Get(':conversationId/attachments/:attachmentId/download')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async getAttachmentDownload(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId', parseUuidPipe('conversationId')) conversationId: string,
    @Param('attachmentId', parseUuidPipe('attachmentId')) attachmentId: string,
  ): Promise<AttachmentDto> {
    return this.chatService.getAttachmentDownload(req.user!, conversationId, attachmentId);
  }
}
