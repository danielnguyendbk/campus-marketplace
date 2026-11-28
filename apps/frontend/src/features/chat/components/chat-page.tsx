'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { authApi, type AuthApi } from '../../auth/api';
import { canPublishMarketplacePosts } from '../../auth/types';
import { useSession } from '../../auth/use-session';
import { MarketplaceShell } from '../../marketplace/components/marketplace-shell';
import marketplaceStyles from '../../marketplace/marketplace.module.css';
import { getMockConversations, sendMockMessage } from '../mock-conversations';
import { Avatar, ConversationThread } from './conversation-thread';
import styles from './chat.module.css';

function Inbox({
  userId,
  postId,
  conversationId,
}: {
  userId: string;
  postId?: string;
  conversationId?: string;
}) {
  const [conversations, setConversations] = useState(() => getMockConversations(userId));
  const selectedId = postId ?? conversationId;
  const conversation = conversations.find(({ id }) => selectedId === id);

  return (
    <div className={styles.inboxWorkspace} data-has-thread={Boolean(conversation)}>
      <section className={styles.conversationList} aria-labelledby="chat-inbox-title">
        <div className={styles.conversationListHeader}>
          <h2 id="chat-inbox-title">Hội thoại</h2>
          <p className={styles.demoNotice}>Dữ liệu mô phỏng</p>
          {selectedId && !conversation && (
            <p className={styles.demoNotice} role="status">
              {postId
                ? 'Mở lại từ chi tiết tin bán để tiếp tục hội thoại với người đăng.'
                : 'Không tìm thấy hội thoại trong tab này.'}
            </p>
          )}
        </div>
        <ul>
          {conversations.map((item) => {
            const latest = item.messages.at(-1);
            const preview =
              latest?.type === 'ATTACHMENT' ? latest.attachment.fileName : latest?.text;
            return (
              <li key={item.id}>
                <Link
                  className={styles.conversationLink}
                  href={`/messages?conversation=${encodeURIComponent(item.id)}`}
                  aria-current={item.id === selectedId ? 'page' : undefined}
                >
                  <Avatar name={item.participant} />
                  <span className={styles.conversationSummary}>
                    <strong>{item.participant}</strong>
                    <span>{item.listing.title}</span>
                    <small>{preview ?? 'Chưa có tin nhắn'}</small>
                  </span>
                  <small>{latest?.time}</small>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      {conversation ? (
        <ConversationThread
          key={conversation.id}
          userId={userId}
          conversation={conversation}
          onSend={(message, file) =>
            setConversations(sendMockMessage(userId, conversation.id, message, file))
          }
        />
      ) : (
        <div className={styles.chooseConversation}>
          <p>Chọn một cuộc trò chuyện</p>
        </div>
      )}
    </div>
  );
}

export function ChatPage({
  postId,
  conversationId,
  client = authApi,
}: {
  postId?: string;
  conversationId?: string;
  client?: AuthApi;
}) {
  const user = useSession(client)?.user;

  return (
    <MarketplaceShell client={client} section="messages">
      {user &&
        (canPublishMarketplacePosts(user) ? (
          <Inbox key={user.id} userId={user.id} postId={postId} conversationId={conversationId} />
        ) : (
          <div className={styles.page}>
            <h1>Tin nhắn</h1>
            <section className={styles.restricted}>
              <h2>Tin nhắn dành cho sinh viên đã xác thực</h2>
              {user.role === 'USER' && user.verificationStatus !== 'SUSPENDED' && (
                <Link href="/verification" className={marketplaceStyles.primaryLink}>
                  Xem hồ sơ xác thực
                </Link>
              )}
            </section>
          </div>
        ))}
    </MarketplaceShell>
  );
}
