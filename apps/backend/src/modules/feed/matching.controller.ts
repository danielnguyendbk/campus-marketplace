import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { VerificationGuard } from '../../common/auth/verification.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { GetFeedQueryDto } from './dto/get-feed-query.dto';
import { FeedPostSummaryDto } from './feed.types';
import { MatchingService } from './services/matching.service';

@Controller('posts')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get(':id/matches')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, VerificationGuard)
  async getPostMatches(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException({
            code: 'VALIDATION_FAILED',
            message: 'ID bài đăng không đúng định dạng UUID.',
            details: [{ field: 'id', message: 'id phải là UUID hợp lệ.' }],
          }),
      }),
    )
    id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetFeedQueryDto,
  ): Promise<PaginatedResult<FeedPostSummaryDto>> {
    return this.matchingService.getPostMatches(id, user, query);
  }
}
