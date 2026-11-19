import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, WsAuthGuard],
  exports: [RealtimeGateway, WsAuthGuard],
})
export class RealtimeModule {}

