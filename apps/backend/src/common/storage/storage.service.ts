import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Local Static / Mock CDN Storage Service for post images.
 * Stores object keys (`posts/<postId>/<sortOrder>-<uuid>.<ext>`) in PostgreSQL
 * and resolves them to valid public HTTP/HTTPS URIs without exposing raw `storageKey`
 * in API responses (OpenAPI PostImage schema).
 */
@Injectable()
export class StorageService {
  private readonly uploadsRoot: string;

  constructor() {
    this.uploadsRoot = path.resolve(process.cwd(), 'uploads');
  }

  getPublicMediaBaseUrl(): string {
    const configured = process.env.PUBLIC_MEDIA_BASE_URL?.trim();
    if (configured) {
      return configured.replace(/\/+$/, '');
    }
    const port = process.env.PORT?.trim() || '3000';
    return `http://localhost:${port}/uploads`;
  }

  async savePostImage(
    postId: string,
    file: Express.Multer.File,
    sortOrder: number,
  ): Promise<string> {
    const ext = MIME_TO_EXTENSION[file.mimetype] ?? 'jpg';
    const storageKey = `posts/${postId}/${sortOrder}-${randomUUID()}.${ext}`;

    if (process.env.NODE_ENV !== 'test' && file.buffer?.length) {
      const targetPath = path.resolve(this.uploadsRoot, storageKey);
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.writeFile(targetPath, file.buffer);
    }

    return storageKey;
  }

  getPublicUrl(storageKey: string): string {
    if (/^https?:\/\//i.test(storageKey)) {
      return storageKey;
    }
    const normalizedKey = storageKey.replace(/^\/+/, '');
    return `${this.getPublicMediaBaseUrl()}/${normalizedKey}`;
  }
}
