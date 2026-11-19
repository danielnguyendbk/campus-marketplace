import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, WsAuthGuard, RealtimeService],
  exports: [RealtimeGateway, WsAuthGuard, RealtimeService],
})
export class RealtimeModule {}

