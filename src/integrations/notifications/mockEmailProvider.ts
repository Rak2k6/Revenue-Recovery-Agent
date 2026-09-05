import { EmailProvider, SendReminderOptions, NotificationResult } from './types';
import { logger } from '../../utils/logger';

export interface MockEmailProviderOptions {
  shouldFail?: boolean;
  failureReason?: string;
}

/**
 * Deterministic Mock Email Provider for MVP.
 *
 * Simulates email delivery without interacting with external email infrastructure.
 * Clearly logs delivery as simulated and supports explicit failure modes for testing.
 */
export class MockEmailProvider implements EmailProvider {
  private options: MockEmailProviderOptions;

  constructor(options: MockEmailProviderOptions = {}) {
    this.options = options;
  }

  public setOptions(options: MockEmailProviderOptions): void {
    this.options = { ...this.options, ...options };
  }

  async sendReminder(options: SendReminderOptions): Promise<NotificationResult> {
    if (this.options.shouldFail) {
      const errorMsg = this.options.failureReason || 'Simulated mock provider delivery failure.';
      logger.warn({ recipientEmail: options.recipientEmail }, `[MOCK EMAIL SIMULATION] Delivery failed: ${errorMsg}`);
      return {
        success: false,
        provider: 'mock',
        error: errorMsg,
      };
    }

    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    logger.info(
      { recipientEmail: options.recipientEmail, recoveryLinkUrl: options.recoveryLinkUrl, messageId },
      '[MOCK EMAIL SIMULATION] Reminder Email Sent'
    );

    return {
      success: true,
      provider: 'mock',
      messageId,
    };
  }
}

