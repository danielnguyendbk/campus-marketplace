import { Module } from '@nestjs/common';
import { VerificationGuard } from '../../common/auth/verification.guard';
import { AuthModule } from '../auth/auth.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { FeedAccessGuard } from './guards/feed-access.guard';
import { MatchingController } from './matching.controller';
import { FeedRepository } from './repositories/feed.repository';
import { MatchingRepository } from './repositories/matching.repository';
import { MatchingService } from './services/matching.service';

@Module({
  imports: [AuthModule],
  controllers: [FeedController, MatchingController],
  providers: [
    FeedRepository,
    FeedService,
    FeedAccessGuard,
    MatchingRepository,
    MatchingService,
    VerificationGuard,
  ],
  exports: [FeedRepository, FeedService, MatchingRepository, MatchingService],
})
export class FeedModule {}
