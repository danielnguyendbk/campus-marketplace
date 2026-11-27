export const chatAttachmentMaxBytes = 10 * 1024 * 1024;
export const chatAttachmentMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
] as const;

export type MockAttachment = {
  fileName: string;
  sizeBytes: number;
} & ({ status: 'ACTIVE'; blob: Blob } | { status: 'EXPIRED' });

type MessageBody =
  { type: 'TEXT'; text: string } | { type: 'ATTACHMENT'; attachment: MockAttachment };

type MockChatMessage = MessageBody & {
  id: string;
  sender: 'self' | 'other';
  time: string;
};

interface ChatListing {
  title: string;
  price: number;
  condition: string;
  id?: string;
  imageUrl?: string;
}

export interface MockConversation {
  id: string;
  participant: string;
  listing: ChatListing;
  status: 'OPEN' | 'ARCHIVED';
  messages: readonly MockChatMessage[];
}

const demoSpecs = new Blob(
  ['ThinkPad T14\nRAM 16 GB · SSD 512 GB\nTệp minh họa Campus Marketplace.'],
  {
    type: 'text/plain',
  },
);

const sampleConversations: readonly MockConversation[] = [
  {
    id: 'demo-laptop',
    participant: 'Quang Huy',
    listing: { title: 'Laptop Lenovo ThinkPad T14', price: 4800000, condition: 'Đã sử dụng tốt' },
    status: 'OPEN',
    messages: [
      {
        id: 'laptop-1',
        sender: 'self',
        type: 'TEXT',
        text: 'Chào bạn, laptop này còn không ạ?',
        time: '09:30',
      },
      {
        id: 'laptop-2',
        sender: 'other',
        type: 'TEXT',
        text: 'Còn nhé. Máy dùng tốt, bạn có thể kiểm tra máy trước khi mua.',
        time: '09:31',
      },
      {
        id: 'laptop-3',
        sender: 'self',
        type: 'TEXT',
        text: 'Bạn gửi mình thông tin cấu hình với nha.',
        time: '09:32',
      },
      {
        id: 'laptop-4',
        sender: 'other',
        type: 'ATTACHMENT',
        attachment: {
          status: 'ACTIVE',
          fileName: 'cau-hinh-thinkpad.txt',
          blob: demoSpecs,
          sizeBytes: demoSpecs.size,
        },
        time: '09:33',
      },
      {
        id: 'laptop-5',
        sender: 'other',
        type: 'ATTACHMENT',
        attachment: { status: 'EXPIRED', fileName: 'anh-ban-phim-cu.jpg', sizeBytes: 1258291 },
        time: '09:34',
      },
    ],
  },
  {
    id: 'demo-textbook',
    participant: 'Thảo Linh',
    listing: { title: 'Giáo trình Giải tích 2', price: 85000, condition: 'Còn tốt' },
    status: 'OPEN',
    messages: [
      {
        id: 'textbook-1',
        sender: 'other',
        type: 'TEXT',
        text: 'Mình có thể mang sách đến thư viện vào chiều mai.',
        time: '09:15',
      },
    ],
  },
  {
    id: 'demo-headphones',
    participant: 'Đăng Khoa',
    listing: { title: 'Tai nghe Sony WH-CH520', price: 650000, condition: 'Còn tốt' },
    status: 'ARCHIVED',
    messages: [
      {
        id: 'headphones-1',
        sender: 'other',
        type: 'TEXT',
        text: 'Mình đã bán tai nghe rồi nhé.',
        time: '16:40',
      },
    ],
  },
];

// Demo messages and listing context live only in this tab's JavaScript memory.
const inboxes = new Map<string, readonly MockConversation[]>();
type MockDraft = { text: string; file?: File };
const drafts = new Map<string, Map<string, MockDraft>>();

export function getMockDraft(userId: string, conversationId: string): MockDraft {
  return drafts.get(userId)?.get(conversationId) ?? { text: '' };
}

export function saveMockDraft(userId: string, conversationId: string, draft: MockDraft) {
  const userDrafts = drafts.get(userId) ?? new Map<string, MockDraft>();
  if (draft.text || draft.file) userDrafts.set(conversationId, draft);
  else userDrafts.delete(conversationId);
  if (userDrafts.size) drafts.set(userId, userDrafts);
  else drafts.delete(userId);
}

export function getMockConversations(userId: string): readonly MockConversation[] {
  return inboxes.get(userId) ?? sampleConversations;
}

export function openMockConversation(userId: string, participant: string, listing: ChatListing) {
  if (!listing.id) return;
  const conversations = getMockConversations(userId);
  const existing = conversations.find((conversation) => conversation.id === listing.id);
  const conversation: MockConversation = {
    id: listing.id,
    participant,
    listing,
    status: 'OPEN',
    messages: existing?.messages ?? [],
  };
  inboxes.set(userId, [conversation, ...conversations.filter(({ id }) => id !== conversation.id)]);
}

export function sendMockMessage(userId: string, conversationId: string, text: string, file?: File) {
  const conversations = getMockConversations(userId);
  const conversation = conversations.find(({ id }) => id === conversationId);
  if (!conversation || conversation.status === 'ARCHIVED') return conversations;

  const bodies: MessageBody[] = [];
  if (file) {
    bodies.push({
      type: 'ATTACHMENT',
      attachment: { status: 'ACTIVE', fileName: file.name, blob: file, sizeBytes: file.size },
    });
  }
  if (text.trim()) bodies.push({ type: 'TEXT', text: text.trim() });
  if (!bodies.length) return conversations;

  const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(),
  );
  const messages: MockChatMessage[] = bodies.map((body, index) => ({
    ...body,
    id: `${conversationId}-${conversation.messages.length + index}`,
    sender: 'self',
    time,
  }));
  const updated = [
    { ...conversation, messages: [...conversation.messages, ...messages] },
    ...conversations.filter(({ id }) => id !== conversationId),
  ];
  inboxes.set(userId, updated);
  return updated;
}
