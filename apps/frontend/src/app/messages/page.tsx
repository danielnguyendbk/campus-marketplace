import React from 'react';
import type { Metadata } from 'next';
import { ChatPage } from '../../features/chat/components/chat-page';

export const metadata: Metadata = {
  title: 'Tin nhắn | Campus Marketplace',
  robots: { index: false, follow: false },
};

export default function Page({
  searchParams,
}: {
  searchParams: { post?: string | string[]; conversation?: string | string[] };
}) {
  const postId = typeof searchParams.post === 'string' ? searchParams.post : undefined;
  const conversationId =
    typeof searchParams.conversation === 'string' ? searchParams.conversation : undefined;
  return (
    <ChatPage key={postId ?? conversationId} postId={postId} conversationId={conversationId} />
  );
}
