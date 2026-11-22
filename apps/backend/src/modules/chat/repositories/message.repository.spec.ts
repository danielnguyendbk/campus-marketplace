import { PostgresService } from '../../../database/postgres.service';
import { MessageRepository } from './message.repository';

describe('MessageRepository', () => {
  const queryMock = jest.fn();
  const withTransactionMock = jest.fn();
  const postgresMock = {
    query: queryMock,
    withTransaction: withTransactionMock,
  } as unknown as PostgresService;
  const repo = new MessageRepository(postgresMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findConversationContext', () => {
    it('returns context when conversation exists', async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 'conv-1',
            post_id: 'post-1',
            member_low_id: 'user-1',
            member_high_id: 'user-2',
            status: 'OPEN',
            post_owner_id: 'user-2',
            post_status: 'ACTIVE',
            post_type: 'SELL',
            member_low_status: 'APPROVED',
            member_high_status: 'APPROVED',
          },
        ],
      });

      const res = await repo.findConversationContext('conv-1');

      expect(res).not.toBeNull();
      expect(res?.id).toBe('conv-1');
      expect(res?.postId).toBe('post-1');
      expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('FROM "conversations" c'), ['conv-1']);
    });

    it('returns null when conversation does not exist', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const res = await repo.findConversationContext('non-existent');
      expect(res).toBeNull();
    });
  });

  describe('insertTextMessage', () => {
    it('executes in transaction and updates last_message_at', async () => {
      const clientMock = {
        query: jest.fn(),
      };
      clientMock.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'msg-1',
              conversation_id: 'conv-1',
              sender_id: 'user-1',
              type: 'TEXT',
              content: 'hello',
              created_at: new Date(),
              expires_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      withTransactionMock.mockImplementationOnce(async (cb) => cb(clientMock));

      const res = await repo.insertTextMessage('conv-1', 'user-1', 'hello');

      expect(res.id).toBe('msg-1');
      expect(res.content).toBe('hello');
      expect(clientMock.query).toHaveBeenCalledTimes(2);
      expect(clientMock.query.mock.calls[0][0]).toContain('INSERT INTO "messages"');
      expect(clientMock.query.mock.calls[1][0]).toContain('UPDATE "conversations"');
    });
  });

  describe('insertAttachmentMessage', () => {
    it('inserts message and attachment in single transaction', async () => {
      const clientMock = {
        query: jest.fn(),
      };
      clientMock.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'msg-1',
              conversation_id: 'conv-1',
              sender_id: 'user-1',
              type: 'ATTACHMENT',
              content: null,
              created_at: new Date(),
              expires_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'att-1',
              message_id: 'msg-1',
              storage_key: 'attachments/conv-1/key.pdf',
              mime_type: 'application/pdf',
              size_bytes: 1024,
              expires_at: new Date(),
              status: 'ACTIVE',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      withTransactionMock.mockImplementationOnce(async (cb) => cb(clientMock));

      const res = await repo.insertAttachmentMessage(
        'conv-1',
        'user-1',
        'attachments/conv-1/key.pdf',
        'application/pdf',
        1024,
      );

      expect(res.message.id).toBe('msg-1');
      expect(res.attachment.id).toBe('att-1');
      expect(clientMock.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('findMessagesByConversationId', () => {
    it('returns list of messages with attachments', async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 'msg-1',
            conversation_id: 'conv-1',
            sender_id: 'user-1',
            type: 'TEXT',
            content: 'Xin chào',
            created_at: new Date(),
            expires_at: new Date(),
            attachment_id: null,
          },
        ],
      });

      const res = await repo.findMessagesByConversationId('conv-1', 20, 0);

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('msg-1');
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('FROM "messages" m'),
        ['conv-1', 20, 0],
      );
    });
  });

  describe('countMessagesByConversationId', () => {
    it('returns total count', async () => {
      queryMock.mockResolvedValueOnce({
        rows: [{ count: 5 }],
      });

      const res = await repo.countMessagesByConversationId('conv-1');
      expect(res).toBe(5);
    });
  });

  describe('findAttachmentById', () => {
    it('returns attachment when found', async () => {
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 'att-1',
            message_id: 'msg-1',
            storage_key: 'attachments/conv-1/att.pdf',
            mime_type: 'application/pdf',
            size_bytes: 1024,
            expires_at: new Date(),
            status: 'ACTIVE',
            conversation_id: 'conv-1',
          },
        ],
      });

      const res = await repo.findAttachmentById('conv-1', 'att-1');

      expect(res).not.toBeNull();
      expect(res?.id).toBe('att-1');
    });

    it('returns null when not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const res = await repo.findAttachmentById('conv-1', 'missing-att');
      expect(res).toBeNull();
    });
  });
});

