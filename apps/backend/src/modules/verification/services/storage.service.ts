import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface UploadResult {
  ref: string;
}

export interface PrivateFileResult {
  buffer: Buffer;
  mimetype: string;
  filename: string;
}

export interface VerifySignatureResult {
  valid: boolean;
  reason?: 'EXPIRED' | 'INVALID_SIGNATURE' | 'MISSING_PARAMS';
}

export interface IStorageService {
  uploadPrivate(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    prefix: string,
  ): Promise<UploadResult>;
  getPresignedDownloadUrl(ref: string, expiresInSeconds?: number): Promise<string>;
  verifyDownloadSignature(ref: string, expires: number, token: string): VerifySignatureResult;
  getPrivateFile(ref: string): Promise<PrivateFileResult>;
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
    const expires = Date.now() + expiresInSeconds * 1000;
    const token = this.generateSignature(ref, expires);
    return `/api/v1/admin/verifications/download?ref=${encodeURIComponent(ref)}&expires=${expires}&token=${token}`;
  }

  generateSignature(ref: string, expires: number): string {
    return crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'default_secret')
      .update(`${ref}:${expires}`)
      .digest('hex');
  }

  verifyDownloadSignature(ref: string, expires: number, token: string): VerifySignatureResult {
    if (!ref || !expires || !token) {
      return { valid: false, reason: 'MISSING_PARAMS' };
    }
    if (Number.isNaN(expires) || Date.now() > expires) {
      return { valid: false, reason: 'EXPIRED' };
    }
    const expected = this.generateSignature(ref, expires);
    if (token.length !== expected.length) {
      return { valid: false, reason: 'INVALID_SIGNATURE' };
    }
    const isValid = crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    return isValid ? { valid: true } : { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  resolveSafePath(ref: string): string {
    if (!ref || ref.includes('..') || path.isAbsolute(ref)) {
      throw new BadRequestException({
        code: 'INVALID_PATH',
        message: 'Đường dẫn tệp không hợp lệ.',
      });
    }
    const fullPath = path.resolve(this.baseStorageDir, ref);
    if (!fullPath.startsWith(this.baseStorageDir)) {
      throw new BadRequestException({
        code: 'INVALID_PATH',
        message: 'Đường dẫn tệp không an toàn.',
      });
    }
    return fullPath;
  }

  async getPrivateFile(ref: string): Promise<PrivateFileResult> {
    const fullPath = this.resolveSafePath(ref);
    try {
      const buffer = await fs.readFile(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      let mimetype = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') mimetype = 'image/jpeg';
      else if (ext === '.png') mimetype = 'image/png';
      else if (ext === '.webp') mimetype = 'image/webp';
      else if (ext === '.pdf') mimetype = 'application/pdf';

      const filename = path.basename(fullPath);
      return { buffer, mimetype, filename };
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error && error.code === 'ENOENT') {
        throw new NotFoundException({
          code: 'FILE_NOT_FOUND',
          message: 'Tệp minh chứng không tồn tại hoặc đã bị xóa.',
        });
      }
      throw err;
    }
  }

  async deleteFile(ref: string): Promise<void> {
    try {
      const fullPath = this.resolveSafePath(ref);
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
