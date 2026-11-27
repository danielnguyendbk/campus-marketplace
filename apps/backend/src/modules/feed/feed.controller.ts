import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { GetFeedQueryDto } from './dto/get-feed-query.dto';
import { FeedService } from './feed.service';
import { FeedItemDto } from './feed.types';
import { FeedAccessGuard } from './guards/feed-access.guard';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, FeedAccessGuard)
  async getFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetFeedQueryDto,
  ): Promise<PaginatedResult<FeedItemDto>> {
    return this.feedService.getFeed(user, query);
  }
}
