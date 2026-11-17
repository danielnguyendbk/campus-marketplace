import { AuthenticatedRequest } from '../../common/auth/jwt-auth.guard';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  let serviceMock: {
    createConversation: jest.Mock;
    listConversations: jest.Mock;
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
      createConversation: jest.fn(),
      listConversations: jest.fn(),
    };
    controller = new ChatController(serviceMock as unknown as ChatService);
  });

  it('delegates createConversation to service', async () => {
    serviceMock.createConversation.mockResolvedValueOnce({ id: 'conv-1' });

    const res = await controller.createConversation(req, { postId: 'post-1' });
    expect(res).toEqual({ id: 'conv-1' });
    expect(serviceMock.createConversation).toHaveBeenCalledWith(user, {
      postId: 'post-1',
    });
  });

  it('delegates listConversations to service', async () => {
    serviceMock.listConversations.mockResolvedValueOnce({ data: [], meta: {} });

    const res = await controller.listConversations(req, { page: 1, limit: 20 });
    expect(res).toEqual({ data: [], meta: {} });
    expect(serviceMock.listConversations).toHaveBeenCalledWith(user, {
      page: 1,
      limit: 20,
    });
  });
});
