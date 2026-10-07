export type MessageRecord = {
  id: string;
  taskId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  senderName?: string;
  senderAvatar?: string;
  senderAvatarColor?: string;
};
