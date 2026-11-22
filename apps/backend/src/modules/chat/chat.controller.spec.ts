import { AuthenticatedRequest } from '../../common/auth/jwt-auth.guard';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  let serviceMock: {
    createConversation: jest.Mock;
    listConversations: jest.Mock;
    listMessages: jest.Mock;
    sendMessage: jest.Mock;
    sendAttachment: jest.Mock;
    getAttachmentDownload: jest.Mock;
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
      listMessages: jest.fn(),
      sendMessage: jest.fn(),
      sendAttachment: jest.fn(),
      getAttachmentDownload: jest.fn(),
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

  it('delegates listMessages to service', async () => {
    serviceMock.listMessages.mockResolvedValueOnce({ data: [], meta: {} });

    const res = await controller.listMessages(req, 'conv-1', { page: 1, limit: 20 });
    expect(res).toEqual({ data: [], meta: {} });
    expect(serviceMock.listMessages).toHaveBeenCalledWith(user, 'conv-1', {
      page: 1,
      limit: 20,
    });
  });

  it('delegates sendTextMessage to service', async () => {
    serviceMock.sendMessage.mockResolvedValueOnce({ id: 'msg-1' });

    const res = await controller.sendTextMessage(req, 'conv-1', { content: 'hello' });
    expect(res).toEqual({ id: 'msg-1' });
    expect(serviceMock.sendMessage).toHaveBeenCalledWith(user, 'conv-1', {
      content: 'hello',
    });
  });

  it('delegates sendAttachment to service', async () => {
    serviceMock.sendAttachment.mockResolvedValueOnce({ id: 'msg-att-1' });
    const mockFile = {} as Express.Multer.File;

    const res = await controller.sendAttachment(req, 'conv-1', mockFile);
    expect(res).toEqual({ id: 'msg-att-1' });
    expect(serviceMock.sendAttachment).toHaveBeenCalledWith(user, 'conv-1', mockFile);
  });

  it('delegates getAttachmentDownload to service', async () => {
    serviceMock.getAttachmentDownload.mockResolvedValueOnce({ id: 'att-1' });

    const res = await controller.getAttachmentDownload(req, 'conv-1', 'att-1');
    expect(res).toEqual({ id: 'att-1' });
    expect(serviceMock.getAttachmentDownload).toHaveBeenCalledWith(user, 'conv-1', 'att-1');
  });
});
