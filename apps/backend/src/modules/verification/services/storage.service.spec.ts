import { BadRequestException, NotFoundException } from '@nestjs/common';
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

    // Read file via getPrivateFile
    const retrieved = await service.getPrivateFile(result.ref);
    expect(retrieved.buffer.toString()).toBe('fake-image-content');
    expect(retrieved.mimetype).toBe('image/png');

    // Clean up
    await service.deleteFile(result.ref);
  });

  it('should generate a presigned download url containing ref, expires, and token', async () => {
    const url = await service.getPresignedDownloadUrl('evidence/user-123/card.jpg');
    expect(url).toContain('/api/v1/admin/verifications/download');
    expect(url).toContain('evidence%2Fuser-123%2Fcard.jpg');
    expect(url).toContain('expires=');
    expect(url).toContain('token=');
  });

  it('should correctly verify valid, expired, and tampered signatures', () => {
    const ref = 'evidence/user-123/card.jpg';
    const futureExpires = Date.now() + 600000;
    const token = service.generateSignature(ref, futureExpires);

    // Valid
    const validResult = service.verifyDownloadSignature(ref, futureExpires, token);
    expect(validResult.valid).toBe(true);

    // Missing params
    expect(service.verifyDownloadSignature('', futureExpires, token).valid).toBe(false);

    // Expired
    const pastExpires = Date.now() - 10000;
    const expiredToken = service.generateSignature(ref, pastExpires);
    const expiredResult = service.verifyDownloadSignature(ref, pastExpires, expiredToken);
    expect(expiredResult.valid).toBe(false);
    expect(expiredResult.reason).toBe('EXPIRED');

    // Tampered token
    const tamperedResult = service.verifyDownloadSignature(ref, futureExpires, 'wrong-token');
    expect(tamperedResult.valid).toBe(false);
    expect(tamperedResult.reason).toBe('INVALID_SIGNATURE');
  });

  it('should prevent path traversal attacks in resolveSafePath', () => {
    expect(() => service.resolveSafePath('../../etc/passwd')).toThrow(BadRequestException);
    expect(() => service.resolveSafePath('evidence/../../../secret.txt')).toThrow(BadRequestException);
    expect(() => service.resolveSafePath('/absolute/path')).toThrow(BadRequestException);
  });

  it('should throw NotFoundException when getting a non-existent file', async () => {
    await expect(service.getPrivateFile('evidence/non-existent-file.png')).rejects.toThrow(
      NotFoundException,
    );
  });
});
