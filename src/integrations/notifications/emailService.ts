import { EmailProvider, SendReminderOptions, NotificationResult } from './types';
import { MockEmailProvider } from './mockEmailProvider';

/**
 * Email Service Boundary.
 * Wraps the underlying EmailProvider so high-level callers remain provider-agnostic.
 */
export class EmailService {
  private provider: EmailProvider;

  constructor(provider?: EmailProvider) {
    this.provider = provider || new MockEmailProvider();
  }

  public getProvider(): EmailProvider {
    return this.provider;
  }

  public setProvider(provider: EmailProvider): void {
    this.provider = provider;
  }

  async sendReminder(options: SendReminderOptions): Promise<NotificationResult> {
    return this.provider.sendReminder(options);
  }
}
