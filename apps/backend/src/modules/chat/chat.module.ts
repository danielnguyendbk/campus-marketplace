import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { ChatAttachmentStorageService } from './services/chat-attachment-storage.service';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ConversationRepository,
    MessageRepository,
    ChatAttachmentStorageService,
  ],
  exports: [
    ChatService,
    ConversationRepository,
    MessageRepository,
    ChatAttachmentStorageService,
  ],
})
export class ChatModule { }
