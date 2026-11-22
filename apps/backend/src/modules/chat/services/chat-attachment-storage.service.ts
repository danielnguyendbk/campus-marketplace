import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export const CHAT_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB = 10485760 bytes

export const CHAT_ATTACHMENT_ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

export interface StoredAttachmentResult {
  storageKey: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

@Injectable()
export class ChatAttachmentStorageService {
  private readonly logger = new Logger(ChatAttachmentStorageService.name);
  private readonly baseStorageDir: string;

  constructor() {
    this.baseStorageDir = path.resolve(
      process.cwd(),
      process.env.STORAGE_LOCAL_DIR || 'storage/private',
    );
  }

  isMimeAllowed(mimeType: string): boolean {
    return CHAT_ATTACHMENT_ALLOWED_MIMES.includes(mimeType.toLowerCase());
  }

  async saveAttachment(
    conversationId: string,
    file: { buffer?: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<StoredAttachmentResult> {
    const rawName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const sanitizedFileName = rawName || 'attachment.dat';
    const uniqueId = crypto.randomUUID();
    const storageKey = `attachments/${conversationId}/${uniqueId}_${sanitizedFileName}`;

    if (process.env.NODE_ENV !== 'test' && file.buffer?.length) {
      const fullPath = path.join(this.baseStorageDir, storageKey);
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, file.buffer);
    }

    this.logger.log(`Stored chat attachment at storage key: ${storageKey}`);

    return {
      storageKey,
      fileName: sanitizedFileName,
      sizeBytes: file.size,
      mimeType: file.mimetype,
    };
  }

  extractFileName(storageKey: string): string | null {
    const base = path.basename(storageKey);
    // Format is `${uniqueId}_${sanitizedFileName}`
    const underscoreIdx = base.indexOf('_');
    if (underscoreIdx !== -1 && underscoreIdx < base.length - 1) {
      return base.substring(underscoreIdx + 1);
    }
    return base || null;
  }

  generateDownloadUrl(conversationId: string, attachmentId: string): string {
    return `/api/v1/conversations/${conversationId}/attachments/${attachmentId}/download`;
  }
}

