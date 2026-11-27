'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  chatAttachmentMaxBytes,
  chatAttachmentMimeTypes,
  getMockDraft,
  saveMockDraft,
  type MockAttachment,
  type MockConversation,
} from '../mock-conversations';
import styles from './chat.module.css';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const fileSize = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const messageLengthLimit = 10_000;

function attachmentSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${fileSize.format(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${fileSize.format(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function AttachmentCard({
  attachment,
  onRemove,
}: {
  attachment: MockAttachment;
  onRemove?: () => void;
}) {
  const { fileName, sizeBytes } = attachment;
  const blob = attachment.status === 'ACTIVE' ? attachment.blob : undefined;
  const [preview, setPreview] = useState<{ blob: Blob; url: string }>();
  const url = preview?.blob === blob ? preview?.url : undefined;
  const canView =
    blob &&
    (blob.type.startsWith('image/') || ['application/pdf', 'text/plain'].includes(blob.type));

  useEffect(() => {
    if (!blob || typeof URL.createObjectURL !== 'function') return;
    const url = URL.createObjectURL(blob);
    setPreview({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return (
    <div className={styles.attachmentCard}>
      {url && blob?.type.startsWith('image/') && (
        <Image
          src={url}
          alt=""
          width={160}
          height={100}
          unoptimized
          className={styles.attachmentImage}
        />
      )}
      <div className={styles.attachmentInfo}>
        <strong>{fileName}</strong>
        <span>{attachmentSize(sizeBytes)}</span>
        {attachment.status === 'EXPIRED' && (
          <span className={styles.expiredFile}>Tệp đã hết hạn</span>
        )}
      </div>
      {(url || onRemove) && (
        <div className={styles.attachmentActions}>
          {url && canView && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Xem tệp ${fileName}`}
            >
              Xem tệp
            </a>
          )}
          {url && !onRemove && (
            <a href={url} download={fileName} aria-label={`Tải tệp ${fileName}`}>
              Tải xuống
            </a>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove}>
              Bỏ tệp
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('');
  return (
    <span className={styles.avatar} aria-hidden="true">
      {initials}
    </span>
  );
}

function RelatedListing({ conversation }: { conversation: MockConversation }) {
  const { listing, status } = conversation;
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <aside className={styles.related} aria-label="Tin liên quan">
      {listing.imageUrl && !imageFailed && (
        <Image
          src={listing.imageUrl}
          alt=""
          width={48}
          height={48}
          unoptimized
          className={styles.listingImage}
          onError={() => setImageFailed(true)}
        />
      )}
      <div className={styles.listingSummary}>
        <strong>{listing.title}</strong>
        <p>
          <b>{currency.format(listing.price)}</b> · {listing.condition}
        </p>
      </div>
      <span className={styles.badge} data-archived={status === 'ARCHIVED'}>
        {status === 'ARCHIVED' ? 'Đã bán' : 'Đang bán'}
      </span>
      {listing.id && (
        <Link className={styles.detailsLink} href={`/posts/${encodeURIComponent(listing.id)}`}>
          Xem tin
        </Link>
      )}
    </aside>
  );
}

export function ConversationThread({
  userId,
  conversation,
  onSend,
  actions,
}: {
  userId: string;
  conversation: MockConversation;
  onSend: (message: string, file?: File) => void;
  actions?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(() => getMockDraft(userId, conversation.id));
  const { text, file } = draft;
  const titleId = useId();
  const [fileError, setFileError] = useState<string>();
  const picker = useRef<HTMLInputElement>(null);
  const attachButton = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const archived = conversation.status === 'ARCHIVED';
  const { messages, participant } = conversation;
  const canSend = !archived && Boolean(text.trim() || file);

  function updateDraft(nextDraft: typeof draft) {
    setDraft(nextDraft);
    saveMockDraft(userId, conversation.id, nextDraft);
  }

  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [messages.length]);

  return (
    <section className={styles.thread} aria-labelledby={titleId}>
      <header className={styles.threadHeader}>
        {!actions && (
          <Link
            href="/messages"
            className={styles.backLink}
            aria-label="Quay về danh sách hội thoại"
          >
            <span aria-hidden="true">‹</span> Hội thoại
          </Link>
        )}
        <Avatar name={participant} />
        <div className={styles.threadTitle}>
          <h2 id={titleId} ref={title} tabIndex={-1}>
            {participant}
          </h2>
        </div>
        <span className={styles.badge} data-archived={archived}>
          {archived ? 'Chỉ đọc' : 'Đang mở'}
        </span>
        {actions}
      </header>

      <RelatedListing conversation={conversation} />

      <div
        ref={history}
        className={styles.history}
        role="log"
        aria-label="Lịch sử tin nhắn"
        tabIndex={0}
      >
        {messages.length ? (
          <ol className={styles.messages}>
            {messages.map((message) => (
              <li key={message.id} className={styles.bubble} data-own={message.sender === 'self'}>
                {message.type === 'TEXT' ? (
                  <p>{message.text}</p>
                ) : (
                  <AttachmentCard attachment={message.attachment} />
                )}
                <small>
                  {message.sender === 'self' ? 'Bạn' : participant} · {message.time}
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>
            Chưa có tin nhắn. Hãy hỏi người bán về món đồ bạn quan tâm.
          </p>
        )}
      </div>

      <div className={styles.threadFooter}>
        {archived && (
          <p className={styles.archivedNotice}>
            Tin đã kết thúc. Bạn vẫn có thể xem lịch sử hội thoại.
          </p>
        )}
        {fileError && (
          <p className={styles.fileError} role="alert">
            {fileError}
          </p>
        )}
        {file && (
          <div className={styles.filePreview} role="group" aria-label="Tệp chờ gửi">
            <AttachmentCard
              attachment={{
                status: 'ACTIVE',
                fileName: file.name,
                sizeBytes: file.size,
                blob: file,
              }}
              onRemove={() => {
                updateDraft({ text });
                attachButton.current?.focus();
              }}
            />
          </div>
        )}
        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSend) return;
            onSend(text, file);
            updateDraft({ text: '' });
            setFileError(undefined);
          }}
        >
          <input
            type="file"
            ref={picker}
            hidden
            disabled={archived}
            aria-label="Chọn tệp đính kèm"
            accept={chatAttachmentMimeTypes.join(',')}
            onChange={(event) => {
              const picked = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!picked || archived) return;
              if (picked.size > chatAttachmentMaxBytes) {
                updateDraft({ text });
                setFileError(
                  'Tệp vượt quá 10 MB. Bạn có thể chia sẻ liên kết Google Drive trong tin nhắn.',
                );
                return;
              }
              if (!chatAttachmentMimeTypes.some((type) => type === picked.type)) {
                updateDraft({ text });
                setFileError(
                  'Định dạng tệp chưa được hỗ trợ. Hãy chọn ảnh JPEG, PNG, WebP hoặc tệp PDF, Word, Excel, TXT.',
                );
                return;
              }
              setFileError(undefined);
              updateDraft({ text, file: picked });
            }}
          />
          <button
            type="button"
            ref={attachButton}
            className={styles.attachButton}
            disabled={archived}
            aria-label="Đính kèm tệp"
            onClick={() => picker.current?.click()}
          >
            Đính kèm
          </button>
          <textarea
            aria-label="Tin nhắn của bạn"
            rows={1}
            maxLength={messageLengthLimit}
            placeholder={archived ? 'Hội thoại đã khóa gửi tin' : 'Nhập tin nhắn…'}
            value={text}
            disabled={archived}
            onChange={(event) => updateDraft({ text: event.target.value, file })}
            onKeyDown={(event) => {
              if (
                event.key !== 'Enter' ||
                event.shiftKey ||
                event.nativeEvent.isComposing ||
                event.keyCode === 229
              )
                return;
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
          />
          <button type="submit" disabled={!canSend}>
            Gửi
          </button>
        </form>
      </div>
    </section>
  );
}
