import { AuthenticatedRequest } from '../../common/auth/jwt-auth.guard';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { ClosePostDto } from './dto/close-post.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { PostLifecycleService } from './post-lifecycle.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

describe('PostsController', () => {
  let controller: PostsController;
  let serviceMock: {
    createPost: jest.Mock;
    getPostById: jest.Mock;
    getMyPosts: jest.Mock;
    revealSellerPhone: jest.Mock;
  };
  let lifecycleMock: {
    hidePost: jest.Mock;
    activatePost: jest.Mock;
    markPostSold: jest.Mock;
    closePost: jest.Mock;
  };

  const user: AuthenticatedUser = {
    id: 'user-1',
    schoolEmail: 'user1@ptithcm.edu.vn',
    role: 'USER',
    verificationStatus: 'APPROVED',
    displayName: 'User 1',
    reputationScore: 5.0,
  };

  const req = { user } as unknown as AuthenticatedRequest;

  beforeEach(() => {
    serviceMock = {
      createPost: jest.fn(),
      getPostById: jest.fn(),
      getMyPosts: jest.fn(),
      revealSellerPhone: jest.fn(),
    };
    lifecycleMock = {
      hidePost: jest.fn(),
      activatePost: jest.fn(),
      markPostSold: jest.fn(),
      closePost: jest.fn(),
    };
    controller = new PostsController(
      serviceMock as unknown as PostsService,
      lifecycleMock as unknown as PostLifecycleService,
    );
  });

  it('delegates createPost to service', async () => {
    const dto = { postType: 'SELL', title: 'Test' } as unknown as CreatePostDto;
    serviceMock.createPost.mockResolvedValueOnce({ id: 'p1' });

    const res = await controller.createPost(req, dto, []);
    expect(res).toEqual({ id: 'p1' });
    expect(serviceMock.createPost).toHaveBeenCalledWith(user, dto, []);
  });

  it('delegates getPostById to service', async () => {
    serviceMock.getPostById.mockResolvedValueOnce({ id: 'p1' });

    const res = await controller.getPostById('p1', req);
    expect(res).toEqual({ id: 'p1' });
    expect(serviceMock.getPostById).toHaveBeenCalledWith('p1', user);
  });

  it('delegates getMyPosts to service', async () => {
    serviceMock.getMyPosts.mockResolvedValueOnce({ items: [], meta: {} });

    const res = await controller.getMyPosts(req, '1', '10', 'ACTIVE');
    expect(res).toEqual({ items: [], meta: {} });
    expect(serviceMock.getMyPosts).toHaveBeenCalledWith(user, 1, 10, 'ACTIVE');
  });

  it('delegates revealSellerPhone to service', async () => {
    serviceMock.revealSellerPhone.mockResolvedValueOnce({
      phoneNumber: '0987654321',
      revealedAt: '2026-11-17T09:00:00.000Z',
    });

    const res = await controller.revealSellerPhone('post-uuid', req);
    expect(res).toEqual({
      phoneNumber: '0987654321',
      revealedAt: '2026-11-17T09:00:00.000Z',
    });
    expect(serviceMock.revealSellerPhone).toHaveBeenCalledWith('post-uuid', user);
  });

  it('delegates hidePost to lifecycle service', async () => {
    lifecycleMock.hidePost.mockResolvedValueOnce({ id: 'p1', status: 'HIDDEN' });

    const res = await controller.hidePost('p1', req);
    expect(res).toEqual({ id: 'p1', status: 'HIDDEN' });
    expect(lifecycleMock.hidePost).toHaveBeenCalledWith('p1', user);
  });

  it('delegates activatePost to lifecycle service', async () => {
    lifecycleMock.activatePost.mockResolvedValueOnce({ id: 'p1', status: 'ACTIVE' });

    const res = await controller.activatePost('p1', req);
    expect(res).toEqual({ id: 'p1', status: 'ACTIVE' });
    expect(lifecycleMock.activatePost).toHaveBeenCalledWith('p1', user);
  });

  it('delegates markPostSold to lifecycle service', async () => {
    lifecycleMock.markPostSold.mockResolvedValueOnce({ id: 'p1', status: 'SOLD' });

    const res = await controller.markPostSold('p1', req);
    expect(res).toEqual({ id: 'p1', status: 'SOLD' });
    expect(lifecycleMock.markPostSold).toHaveBeenCalledWith('p1', user);
  });

  it('delegates closePost to lifecycle service', async () => {
    const dto: ClosePostDto = { reason: 'Đã hoàn thành' };
    lifecycleMock.closePost.mockResolvedValueOnce({ id: 'p1', status: 'CLOSED', closeReason: 'Đã hoàn thành' });

    const res = await controller.closePost('p1', req, dto);
    expect(res).toEqual({ id: 'p1', status: 'CLOSED', closeReason: 'Đã hoàn thành' });
    expect(lifecycleMock.closePost).toHaveBeenCalledWith('p1', user, dto);
  });
});
