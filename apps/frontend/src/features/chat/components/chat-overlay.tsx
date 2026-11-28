'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authApi, type AuthApi } from '../../auth/api';
import { canPublishMarketplacePosts } from '../../auth/types';
import { useSession } from '../../auth/use-session';
import {
  getMockConversations,
  sendMockMessage,
  type MockConversation,
} from '../mock-conversations';
import { Avatar, ConversationThread } from './conversation-thread';
import styles from './chat.module.css';

type OpenChat = (
  id: string,
  event: React.MouseEvent<HTMLAnchorElement>,
  returnFocus?: HTMLElement | null,
) => void;
const ChatOverlayContext = createContext<OpenChat | undefined>(undefined);
const compactViewport = '(max-width: 760px)';

export function useOpenChat() {
  return useContext(ChatOverlayContext);
}

export function ChatOverlayProvider({
  children,
  client = authApi,
}: {
  children: React.ReactNode;
  client?: AuthApi;
}) {
  const user = useSession(client)?.user;
  const pathname = usePathname();
  const [popup, setPopup] = useState<{
    userId: string;
    conversation: MockConversation;
    minimized: boolean;
  }>();
  const opener = useRef<HTMLElement | null>(null);
  const minimizedButton = useRef<HTMLButtonElement>(null);
  const canShow = Boolean(
    pathname &&
    canPublishMarketplacePosts(user) &&
    !['/messages', '/login', '/register', '/admin'].includes(pathname) &&
    !pathname.startsWith('/admin/'),
  );

  useEffect(() => {
    if (popup && (!canShow || popup.userId !== user?.id)) setPopup(undefined);
  }, [canShow, popup, user?.id]);

  useEffect(() => {
    if (popup?.minimized) minimizedButton.current?.focus();
  }, [popup?.minimized]);

  const openChat: OpenChat = (conversationId, event, returnFocus) => {
    if (
      !user ||
      !canShow ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      window.matchMedia?.(compactViewport).matches
    )
      return;

    const conversation = getMockConversations(user.id).find(({ id }) => id === conversationId);
    if (!conversation) return;
    event.preventDefault();
    opener.current = returnFocus ?? event.currentTarget;
    setPopup({ userId: user.id, conversation, minimized: false });
  };

  function closeChat() {
    setPopup(undefined);
    if (opener.current?.isConnected) opener.current.focus();
  }

  return (
    <ChatOverlayContext.Provider value={openChat}>
      {children}
      {canShow && popup && popup.userId === user?.id && (
        <aside
          className={styles.floatingChat}
          data-minimized={popup.minimized}
          aria-label={`Trò chuyện nhanh với ${popup.conversation.participant}`}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
            event.stopPropagation();
            closeChat();
          }}
        >
          {popup.minimized ? (
            <div className={styles.minimizedChat}>
              <button
                type="button"
                ref={minimizedButton}
                className={styles.restoreChat}
                aria-label={`Tiếp tục chat với ${popup.conversation.participant}`}
                onClick={() => setPopup({ ...popup, minimized: false })}
              >
                <Avatar name={popup.conversation.participant} />
                <span>{popup.conversation.participant}</span>
              </button>
              <button
                className={styles.floatingAction}
                type="button"
                aria-label="Đóng cửa sổ chat"
                onClick={closeChat}
              >
                ×
              </button>
            </div>
          ) : (
            <ConversationThread
              key={popup.conversation.id}
              userId={popup.userId}
              conversation={popup.conversation}
              onSend={(message, file) => {
                const conversation = sendMockMessage(
                  popup.userId,
                  popup.conversation.id,
                  message,
                  file,
                ).find(({ id }) => id === popup.conversation.id);
                if (conversation) setPopup({ ...popup, conversation });
              }}
              actions={
                <div className={styles.floatingActions}>
                  <Link
                    className={styles.floatingAction}
                    href={`/messages?conversation=${encodeURIComponent(popup.conversation.id)}`}
                    aria-label="Mở rộng trong hộp thư"
                    title="Mở rộng trong hộp thư"
                    onClick={() => setPopup(undefined)}
                  >
                    ↗
                  </Link>
                  <button
                    className={styles.floatingAction}
                    type="button"
                    aria-label="Thu gọn cửa sổ chat"
                    title="Thu gọn cửa sổ chat"
                    onClick={() => setPopup({ ...popup, minimized: true })}
                  >
                    −
                  </button>
                  <button
                    className={styles.floatingAction}
                    type="button"
                    aria-label="Đóng cửa sổ chat"
                    title="Đóng cửa sổ chat"
                    onClick={closeChat}
                  >
                    ×
                  </button>
                </div>
              }
            />
          )}
        </aside>
      )}
    </ChatOverlayContext.Provider>
  );
}
