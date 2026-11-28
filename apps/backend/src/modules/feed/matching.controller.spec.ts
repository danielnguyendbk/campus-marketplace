import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { VerificationGuard } from '../../common/auth/verification.guard';
import { MatchingController } from './matching.controller';
import { MatchingService } from './services/matching.service';

describe('MatchingController', () => {
  const matchingServiceMock = {
    getPostMatches: jest.fn(),
  } as unknown as jest.Mocked<MatchingService>;

  const controller = new MatchingController(matchingServiceMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('declares @Controller("posts") and secures getPostMatches with JwtAuthGuard + VerificationGuard', () => {
    expect(Reflect.getMetadata(PATH_METADATA, MatchingController)).toBe(
      'posts',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.getPostMatches),
    ).toBe(':id/matches');

    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      controller.getPostMatches,
    );
    expect(guards).toEqual([JwtAuthGuard, VerificationGuard]);
  });

  it('delegates id, current user, and pagination query to MatchingService.getPostMatches', async () => {
    const user: AuthenticatedUser = {
      id: 'user-1',
      schoolEmail: 'user1@ptit.edu.vn',
      role: 'USER',
      verificationStatus: 'APPROVED',
      province: 'Hà Nội',
    };
    const expected = {
      data: [],
      meta: { page: 2, limit: 5, total: 0, totalPages: 0 },
    };
    matchingServiceMock.getPostMatches.mockResolvedValueOnce(expected);

    const result = await controller.getPostMatches('post-uuid-1', user, {
      page: 2,
      limit: 5,
    });

    expect(matchingServiceMock.getPostMatches).toHaveBeenCalledWith(
      'post-uuid-1',
      user,
      { page: 2, limit: 5 },
    );
    expect(result).toBe(expected);
  });
});
