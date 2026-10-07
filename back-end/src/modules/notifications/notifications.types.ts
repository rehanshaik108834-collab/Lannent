export type NotificationRecord = {
  id: string;
  userId: string;
  text: string;
  subtext: string;
  type?: string;
  read: boolean;
  createdAt: string;
  link?: string;
  icon?: string;
};
