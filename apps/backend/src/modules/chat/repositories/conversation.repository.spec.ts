import { PostgresService } from '../../../database/postgres.service';
import { ConversationRepository } from './conversation.repository';

describe('ConversationRepository', () => {
  const queryMock = jest.fn();
  const postgresMock = { query: queryMock } as unknown as PostgresService;
  const repo = new ConversationRepository(postgresMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('finds post for conversation', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'post-1',
          seller_id: 'seller-1',
          post_type: 'SELL',
          status: 'ACTIVE',
          seller_verification_status: 'APPROVED',
        },
      ],
    });

    const res = await repo.findPostForConversation('post-1');
    expect(res).not.toBeNull();
    expect(res?.seller_id).toBe('seller-1');
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain('FROM "posts" p');
  });

  it('returns null when post is not found', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const res = await repo.findPostForConversation('missing-post');
    expect(res).toBeNull();
  });

  it('upserts conversation and returns row', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'conv-1',
          post_id: 'post-1',
          member_low_id: 'user-a',
          member_high_id: 'user-b',
          status: 'OPEN',
          last_message_at: null,
          created_at: new Date('2026-11-17T09:00:00Z'),
        },
      ],
    });

    const res = await repo.upsertConversation('post-1', 'user-a', 'user-b');
    expect(res.id).toBe('conv-1');
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain('INSERT INTO "conversations"');
    expect(queryMock.mock.calls[0][0]).toContain('ON CONFLICT');
  });

  it('gets users summary mapped properly', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          display_name: 'Nguyen Van A',
          verification_status: 'APPROVED',
          reputation_score: '5.00',
          province: 'TP. Hồ Chí Minh',
        },
      ],
    });

    const res = await repo.getUsersSummary(['user-1']);
    expect(res).toHaveLength(1);
    expect(res[0].reputationScore).toBe(5);
    expect(res[0].displayName).toBe('Nguyen Van A');
  });

  it('finds conversations by user id with pagination', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'conv-1',
            post_id: 'post-1',
            member_low_id: 'user-a',
            member_high_id: 'user-b',
            status: 'OPEN',
            last_message_at: null,
            created_at: new Date('2026-11-17T09:00:00Z'),
            post_status: 'ACTIVE',
            post_type: 'SELL',
            low_id: 'user-a',
            low_display_name: 'User A',
            low_verification_status: 'APPROVED',
            low_reputation_score: '5.00',
            low_province: null,
            high_id: 'user-b',
            high_display_name: 'User B',
            high_verification_status: 'APPROVED',
            high_reputation_score: '4.80',
            high_province: null,
          },
        ],
      });

    const res = await repo.findConversationsByUserId('user-a', 1, 20);
    expect(res.total).toBe(1);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].low_display_name).toBe('User A');
  });
});
