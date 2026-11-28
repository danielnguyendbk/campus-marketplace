import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { FeedAccessGuard } from './guards/feed-access.guard';

describe('FeedController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    schoolEmail: 'sv@ptithcm.edu.vn',
    role: 'USER',
    verificationStatus: 'APPROVED',
  };

  it('forwards authenticated user and pagination query to FeedService.getFeed', async () => {
    const expected = {
      data: [],
      meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
    };
    const getFeedMock = jest.fn().mockResolvedValueOnce(expected);
    const controller = new FeedController({
      getFeed: getFeedMock,
    } as unknown as FeedService);

    const result = await controller.getFeed(user, { page: 2, limit: 10 });

    expect(getFeedMock).toHaveBeenCalledWith(user, { page: 2, limit: 10 });
    expect(result).toEqual(expected);
  });

  it('is exposed as GET /feed guarded by JwtAuthGuard and FeedAccessGuard', () => {
    expect(Reflect.getMetadata(PATH_METADATA, FeedController)).toBe('feed');
    expect(Reflect.getMetadata(PATH_METADATA, FeedController.prototype.getFeed)).toBe(
      '/',
    );
    expect(
      Reflect.getMetadata(METHOD_METADATA, FeedController.prototype.getFeed),
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, FeedController.prototype.getFeed),
    ).toEqual([JwtAuthGuard, FeedAccessGuard]);
  });

  it('propagates FeedService errors unchanged', async () => {
    const failure = new Error('database unavailable');
    const controller = new FeedController({
      getFeed: jest.fn().mockRejectedValueOnce(failure),
    } as unknown as FeedService);

    await expect(controller.getFeed(user, {})).rejects.toBe(failure);
  });
});
