import { EmailService } from './emailService';
import { EmailProvider, SendReminderOptions, NotificationResult } from './types';

/**
 * Top-level Notification Service.
 * Coordinates notification delivery without exposing provider implementation details.
 */
export class NotificationService {
  private emailService: EmailService;

  constructor(emailServiceOrProvider?: EmailService | EmailProvider) {
    if (!emailServiceOrProvider) {
      this.emailService = new EmailService();
    } else if ('sendReminder' in emailServiceOrProvider && typeof emailServiceOrProvider.sendReminder === 'function') {
      this.emailService = new EmailService(emailServiceOrProvider as EmailProvider);
    } else {
      this.emailService = emailServiceOrProvider as EmailService;
    }
  }

  public getEmailService(): EmailService {
    return this.emailService;
  }

  async sendRecoveryReminder(options: SendReminderOptions): Promise<NotificationResult> {
    if (!options.recipientEmail) {
      return {
        success: false,
        provider: 'none',
        error: 'Recipient email is missing.',
      };
    }

    if (!options.recoveryLinkUrl) {
      return {
        success: false,
        provider: 'none',
        error: 'Recovery link URL is missing.',
      };
    }

    return this.emailService.sendReminder(options);
  }
}

export const defaultNotificationService = new NotificationService();
