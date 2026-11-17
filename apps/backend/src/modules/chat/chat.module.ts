import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationRepository } from './repositories/conversation.repository';

@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  providers: [ChatService, ConversationRepository],
  exports: [ChatService, ConversationRepository],
})
export class ChatModule {}
