export type NotificationState = 'UNREAD' | 'READ' | 'ACTION_REQUIRED' | 'COMPLETED';

export type NotificationType = 'PAYMENT_FAILURE' | 'PAYMENT_RECOVERY' | 'ORDER_CONFIRMED' | 'PROMOTIONAL' | string;

export interface CustomerNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  recoveryCaseId?: string;
  paymentId?: string;
  actionUrl?: string;
  actionLabel?: string;
  recoveryLinkUrl?: string;
  state: NotificationState;
  read: boolean;
  createdAt: string;
  metadata?: {
    orderId?: string;
    amount?: number;
    currency?: string;
  };
}

export interface NotificationsResponse {
  notifications: CustomerNotification[];
  unreadCount: number;
  serverTime: string;
}

export interface RecoveryCaseDetails {
  recoveryCaseId: string;
  orderId: string;
  amount: number;
  currency: string;
  itemName: string;
  status: 'INITIATED' | 'PIPELINE_EVALUATING' | 'LINK_GENERATED' | 'RECOVERED';
  recoveryLinkUrl: string;
  customer?: {
    name: string;
    email: string;
  };
}
