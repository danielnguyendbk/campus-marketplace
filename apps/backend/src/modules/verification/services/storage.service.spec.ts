import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should upload a private file and return its ref', async () => {
    const file = {
      buffer: Buffer.from('fake-image-content'),
      originalname: 'student-card.png',
      mimetype: 'image/png',
    };

    const result = await service.uploadPrivate(file, 'evidence/user-123');

    expect(result).toBeDefined();
    expect(result.ref).toMatch(/^evidence\/user-123\/[a-f0-9-]+\.png$/);

    // Clean up
    await service.deleteFile(result.ref);
  });

  it('should generate a presigned download url containing the ref and token', async () => {
    const url = await service.getPresignedDownloadUrl('evidence/user-123/card.jpg');
    expect(url).toContain('/api/v1/admin/verifications/download');
    expect(url).toContain('evidence%2Fuser-123%2Fcard.jpg');
    expect(url).toContain('token=');
  });
});

