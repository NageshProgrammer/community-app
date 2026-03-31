import type { ReactNode } from "react";


export type NotificationType = 'lead' | 'message' | 'system' | 'update';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  icon: ReactNode;
}