import { Injectable } from '@nestjs/common';
import { PostgresService } from '../../../database/postgres.service';
import {
  ConversationParticipantContext,
  MessageType,
  AttachmentStatus,
} from '../chat.types';

export interface RawMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  content: string | null;
  created_at: Date;
  expires_at: Date;
  attachment_id?: string | null;
  attachment_storage_key?: string | null;
  attachment_mime_type?: string | null;
  attachment_size_bytes?: number | string | null;
  attachment_expires_at?: Date | null;
  attachment_status?: AttachmentStatus | null;
}

export interface RawAttachmentRow {
  id: string;
  message_id: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number | string;
  expires_at: Date;
  status: AttachmentStatus;
  conversation_id: string;
}

@Injectable()
export class MessageRepository {
  constructor(private readonly pg: PostgresService) { }

  async findConversationContext(
    conversationId: string,
  ): Promise<ConversationParticipantContext | null> {
    const query = `
      SELECT 
        c.id,
        c.post_id,
        c.member_low_id,
        c.member_high_id,
        c.status,
        p.owner_id AS post_owner_id,
        p.status AS post_status,
        p.post_type,
        u_low.verification_status AS member_low_status,
        u_high.verification_status AS member_high_status
      FROM "conversations" c
      JOIN "posts" p ON p.id = c.post_id
      JOIN "users" u_low ON u_low.id = c.member_low_id
      JOIN "users" u_high ON u_high.id = c.member_high_id
      WHERE c.id = $1
      LIMIT 1
    `;

    const result = await this.pg.query(query, [conversationId]);
    if (!result.rows.length) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: String(row.id),
      postId: String(row.post_id),
      memberLowId: String(row.member_low_id),
      memberHighId: String(row.member_high_id),
      status: row.status as ConversationParticipantContext['status'],
      postOwnerId: String(row.post_owner_id),
      postStatus: String(row.post_status),
      postType: String(row.post_type),
      memberLowStatus: row.member_low_status as ConversationParticipantContext['memberLowStatus'],
      memberHighStatus: row.member_high_status as ConversationParticipantContext['memberHighStatus'],
    };
  }

  async insertTextMessage(
    conversationId: string,
    senderId: string,
    content: string,
  ): Promise<RawMessageRow> {
    return this.pg.withTransaction(async (client) => {
      const msgQuery = `
        INSERT INTO "messages" (
          "id", "conversation_id", "sender_id", "type", "content", "created_at", "expires_at"
        ) VALUES (
          gen_random_uuid(), $1, $2, 'TEXT', $3, clock_timestamp(), clock_timestamp() + INTERVAL '3 months'
        )
        RETURNING "id", "conversation_id", "sender_id", "type", "content", "created_at", "expires_at"
      `;
      const res = await client.query(msgQuery, [conversationId, senderId, content]);

      await client.query(
        `UPDATE "conversations" SET "last_message_at" = clock_timestamp() WHERE "id" = $1`,
        [conversationId],
      );

      return res.rows[0] as unknown as RawMessageRow;
    });
  }

  async insertAttachmentMessage(
    conversationId: string,
    senderId: string,
    storageKey: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<{ message: RawMessageRow; attachment: RawAttachmentRow }> {
    return this.pg.withTransaction(async (client) => {
      const msgQuery = `
        INSERT INTO "messages" (
          "id", "conversation_id", "sender_id", "type", "content", "created_at", "expires_at"
        ) VALUES (
          gen_random_uuid(), $1, $2, 'ATTACHMENT', NULL, clock_timestamp(), clock_timestamp() + INTERVAL '1 month'
        )
        RETURNING "id", "conversation_id", "sender_id", "type", "content", "created_at", "expires_at"
      `;
      const msgRes = await client.query(msgQuery, [conversationId, senderId]);
      const message = msgRes.rows[0] as unknown as RawMessageRow;

      const attQuery = `
        INSERT INTO "attachments" (
          "id", "message_id", "storage_key", "mime_type", "size_bytes", "expires_at", "status"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, clock_timestamp() + INTERVAL '1 month', 'ACTIVE'
        )
        RETURNING "id", "message_id", "storage_key", "mime_type", "size_bytes", "expires_at", "status"
      `;
      const attRes = await client.query(attQuery, [message.id, storageKey, mimeType, sizeBytes]);
      const attachment = {
        ...(attRes.rows[0] as unknown as RawAttachmentRow),
        conversation_id: conversationId,
      };

      await client.query(
        `UPDATE "conversations" SET "last_message_at" = clock_timestamp() WHERE "id" = $1`,
        [conversationId],
      );

      return { message, attachment };
    });
  }

  async findMessagesByConversationId(
    conversationId: string,
    limit: number,
    offset: number,
  ): Promise<RawMessageRow[]> {
    const query = `
      SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.type,
        m.content,
        m.created_at,
        m.expires_at,
        a.id AS attachment_id,
        a.storage_key AS attachment_storage_key,
        a.mime_type AS attachment_mime_type,
        a.size_bytes AS attachment_size_bytes,
        a.expires_at AS attachment_expires_at,
        a.status AS attachment_status
      FROM "messages" m
      LEFT JOIN "attachments" a ON a.message_id = m.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `;

    const res = await this.pg.query(query, [conversationId, limit, offset]);
    return res.rows as unknown as RawMessageRow[];
  }

  async countMessagesByConversationId(conversationId: string): Promise<number> {
    const query = `SELECT COUNT(*)::int AS count FROM "messages" WHERE "conversation_id" = $1`;
    const res = await this.pg.query(query, [conversationId]);
    return Number(res.rows[0]?.count ?? 0);
  }

  async findAttachmentById(
    conversationId: string,
    attachmentId: string,
  ): Promise<RawAttachmentRow | null> {
    const query = `
      SELECT 
        a.id,
        a.message_id,
        a.storage_key,
        a.mime_type,
        a.size_bytes,
        a.expires_at,
        a.status,
        m.conversation_id
      FROM "attachments" a
      JOIN "messages" m ON m.id = a.message_id
      WHERE a.id = $1 AND m.conversation_id = $2
      LIMIT 1
    `;

    const res = await this.pg.query(query, [attachmentId, conversationId]);
    if (!res.rows.length) {
      return null;
    }
    return res.rows[0] as unknown as RawAttachmentRow;
  }
}
