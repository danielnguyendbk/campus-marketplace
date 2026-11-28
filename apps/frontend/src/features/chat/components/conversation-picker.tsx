'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { getMockConversations, type MockConversation } from '../mock-conversations';
import { useOpenChat } from './chat-overlay';
import styles from './chat.module.css';

export function ConversationPicker({ userId, icon }: { userId: string; icon: React.ReactNode }) {
  const [recent, setRecent] = useState<readonly MockConversation[] | null>(null);
  const openChat = useOpenChat();
  const panelId = useId();
  const picker = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const open = recent !== null;

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (event.target instanceof Node && !picker.current?.contains(event.target)) setRecent(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setRecent(null);
      trigger.current?.focus();
    }

    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={picker}
      className={styles.picker}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setRecent(null);
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.pickerTrigger}
        aria-label="Tin nhắn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setRecent(open ? null : getMockConversations(userId).slice(0, 8))}
      >
        {icon}
        <span className={styles.pickerLabel}>Tin nhắn</span>
      </button>
      <section
        id={panelId}
        aria-label="Hội thoại gần đây"
        className={styles.pickerPanel}
        hidden={!open}
      >
        {recent && (
          <>
            <h2>Hội thoại gần đây</h2>
            {recent.length ? (
              <ul>
                {recent.map(({ id, participant, listing, messages }) => {
                  const latest = messages.at(-1);
                  const preview =
                    latest?.type === 'ATTACHMENT' ? latest.attachment.fileName : latest?.text;
                  const initials = participant
                    .trim()
                    .split(/\s+/)
                    .slice(-2)
                    .map((part) => part[0])
                    .join('');
                  return (
                    <li key={id}>
                      <Link
                        className={styles.conversationLink}
                        href={`/messages?conversation=${encodeURIComponent(id)}`}
                        onClick={(event) => {
                          openChat?.(id, event, trigger.current);
                          setRecent(null);
                        }}
                      >
                        <span className={styles.avatar} aria-hidden="true">
                          {initials}
                        </span>
                        <span className={styles.conversationSummary}>
                          <strong>{participant}</strong>
                          <span>{listing.title}</span>
                          <small>{preview ?? 'Chưa có tin nhắn'}</small>
                        </span>
                        <small>{latest?.time}</small>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>Chưa có hội thoại nào.</p>
            )}
            <Link href="/messages" className={styles.pickerAllLink} onClick={() => setRecent(null)}>
              Xem tất cả
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
