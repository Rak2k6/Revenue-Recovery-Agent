export interface SendReminderOptions {
  recipientEmail: string;
  recoveryLinkUrl: string;
  paymentId?: string;
  revenueAtRisk?: number;
}

export interface NotificationResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  sendReminder(options: SendReminderOptions): Promise<NotificationResult>;
}
