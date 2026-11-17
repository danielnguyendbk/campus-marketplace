import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface UploadResult {
  ref: string;
}

export interface IStorageService {
  uploadPrivate(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    prefix: string,
  ): Promise<UploadResult>;
  getPresignedDownloadUrl(ref: string, expiresInSeconds?: number): Promise<string>;
  deleteFile(ref: string): Promise<void>;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';

@Injectable()
export class StorageService implements IStorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly baseStorageDir: string;

  constructor() {
    this.baseStorageDir = path.resolve(
      process.cwd(),
      process.env.STORAGE_LOCAL_DIR || 'storage/private',
    );
  }

  async uploadPrivate(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    prefix: string,
  ): Promise<UploadResult> {
    const ext = path.extname(file.originalname).toLowerCase() || this.getExtensionFromMime(file.mimetype);
    const uniqueId = crypto.randomUUID();
    const ref = `${prefix}/${uniqueId}${ext}`;

    const fullPath = path.join(this.baseStorageDir, ref);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, file.buffer);

    this.logger.log(`Stored private file securely at ref: ${ref}`);
    return { ref };
  }

  async getPresignedDownloadUrl(ref: string, expiresInSeconds = 900): Promise<string> {
    // Generates a mock or signed URL for administrative inspection
    const token = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'default_secret')
      .update(`${ref}:${Date.now() + expiresInSeconds * 1000}`)
      .digest('hex');
    return `/api/v1/admin/verifications/download?ref=${encodeURIComponent(ref)}&token=${token}`;
  }

  async deleteFile(ref: string): Promise<void> {
    const fullPath = path.join(this.baseStorageDir, ref);
    try {
      await fs.unlink(fullPath);
      this.logger.log(`Deleted private file ref: ${ref}`);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  private getExtensionFromMime(mime: string): string {
    switch (mime.toLowerCase()) {
      case 'image/jpeg':
      case 'image/jpg':
        return '.jpg';
      case 'image/png':
        return '.png';
      default:
        return '.bin';
    }
  }
}

