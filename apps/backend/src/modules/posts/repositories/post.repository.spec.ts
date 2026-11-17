import { PoolClient } from 'pg';
import { PostgresService } from '../../../database/postgres.service';
import { PostRepository } from './post.repository';

describe('PostRepository', () => {
  const queryMock = jest.fn();
  const postgresMock = { query: queryMock } as unknown as PostgresService;
  const repo = new PostRepository(postgresMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts post, sell_details, and post_images via transaction client', async () => {
    const clientQueryMock = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'post-1',
            owner_id: 'user-1',
            post_type: 'SELL',
            title: 'Giáo trình Java',
            description: 'Còn mới',
            category_id: 'TEXTBOOK',
            province: 'TP. Hồ Chí Minh',
            status: 'ACTIVE',
            close_reason: null,
            ended_at: null,
            created_at: new Date('2026-11-17T00:00:00Z'),
            updated_at: new Date('2026-11-17T00:00:00Z'),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            post_id: 'post-1',
            price: '120000.00',
            condition: 'Tốt',
            allow_phone_reveal: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'img-1',
            post_id: 'post-1',
            storage_key: 'posts/post-1/0-abc.jpg',
            sort_order: 0,
          },
        ],
      });

    const client = { query: clientQueryMock } as unknown as PoolClient;

    const post = await repo.insertPost(
      {
        ownerId: 'user-1',
        postType: 'SELL',
        title: 'Giáo trình Java',
        description: 'Còn mới',
        categoryId: 'TEXTBOOK',
        province: 'TP. Hồ Chí Minh',
      },
      client,
    );

    const sell = await repo.insertSellDetails(
      {
        postId: post.id,
        price: 120000,
        condition: 'Tốt',
        allowPhoneReveal: true,
      },
      client,
    );

    const images = await repo.insertPostImages(
      post.id,
      [{ storageKey: 'posts/post-1/0-abc.jpg', sortOrder: 0 }],
      client,
    );

    expect(post.id).toBe('post-1');
    expect(sell.condition).toBe('Tốt');
    expect(images).toHaveLength(1);
    expect(clientQueryMock).toHaveBeenCalledTimes(3);
    expect(clientQueryMock.mock.calls[0][0]).toContain('INSERT INTO "posts"');
    expect(clientQueryMock.mock.calls[1][0]).toContain('INSERT INTO "sell_details"');
    expect(clientQueryMock.mock.calls[2][0]).toContain('INSERT INTO "post_images"');
  });

  it('inserts buy_request_details with post_id, budget_min and budget_max', async () => {
    const clientQueryMock = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          post_id: 'post-buy-1',
          budget_min: '100000.00',
          budget_max: '150000.00',
        },
      ],
    });
    const client = { query: clientQueryMock } as unknown as PoolClient;

    const detail = await repo.insertBuyRequestDetails(
      { postId: 'post-buy-1', budgetMin: 100000, budgetMax: 150000 },
      client,
    );

    expect(detail.budget_min).toBe('100000.00');
    expect(clientQueryMock).toHaveBeenCalledTimes(1);
    expect(clientQueryMock.mock.calls[0][0]).toContain(
      'INSERT INTO "buy_request_details"',
    );
    expect(clientQueryMock.mock.calls[0][1]).toEqual([
      'post-buy-1',
      100000,
      150000,
    ]);
  });

  it('returns null when findPostDetailById finds no matching active row', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    await expect(repo.findPostDetailById('missing-id')).resolves.toBeNull();
  });
});
