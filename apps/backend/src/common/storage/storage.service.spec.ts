import { StorageService } from './storage.service';

describe('StorageService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test', PORT: '4000' };
    delete process.env.PUBLIC_MEDIA_BASE_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('generates storageKey with expected extension and resolves default local URL', async () => {
    const service = new StorageService();
    const key = await service.savePostImage(
      'post-123',
      {
        mimetype: 'image/png',
        buffer: Buffer.from('fake-png'),
      } as Express.Multer.File,
      0,
    );

    expect(key).toMatch(/^posts\/post-123\/0-[0-9a-f-]+\.png$/);
    expect(service.getPublicUrl(key)).toBe(`http://localhost:4000/uploads/${key}`);
  });

  it('uses PUBLIC_MEDIA_BASE_URL when configured', () => {
    process.env.PUBLIC_MEDIA_BASE_URL = 'https://cdn.campus.local/';
    const service = new StorageService();
    expect(service.getPublicUrl('posts/p1/0-abc.jpg')).toBe(
      'https://cdn.campus.local/posts/p1/0-abc.jpg',
    );
  });
});
