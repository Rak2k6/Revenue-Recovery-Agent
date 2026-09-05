import { NotificationService } from '../src/integrations/notifications/notificationService';
import { MockEmailProvider } from '../src/integrations/notifications/mockEmailProvider';
import { EmailService } from '../src/integrations/notifications/emailService';
import { EmailProvider, SendReminderOptions } from '../src/integrations/notifications/types';

describe('NotificationService & MockEmailProvider (Phase 3D)', () => {

  it('1. Successful mock delivery returns structured success result', async () => {
    const mockProvider = new MockEmailProvider();
    const service = new NotificationService(mockProvider);

    const result = await service.sendRecoveryReminder({
      recipientEmail: 'customer@example.com',
      recoveryLinkUrl: 'https://rzp.io/i/test123',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('mock');
    expect(result.messageId).toBeDefined();
    expect(result.messageId).toMatch(/^mock_msg_/);
  });

  it('2. Provider failure returns controlled failure object', async () => {
    const mockProvider = new MockEmailProvider({ shouldFail: true, failureReason: 'Simulated network drop' });
    const service = new NotificationService(mockProvider);

    const result = await service.sendRecoveryReminder({
      recipientEmail: 'customer@example.com',
      recoveryLinkUrl: 'https://rzp.io/i/test123',
    });

    expect(result.success).toBe(false);
    expect(result.provider).toBe('mock');
    expect(result.error).toBe('Simulated network drop');
  });

  it('3. Trusted recipient — notification receives customer email supplied by trusted data', async () => {
    const spyProvider: EmailProvider = {
      sendReminder: jest.fn().mockResolvedValue({ success: true, provider: 'spy', messageId: 'spy_1' }),
    };
    const service = new NotificationService(spyProvider);

    const trustedEmail = 'trusted_user@domain.com';
    await service.sendRecoveryReminder({
      recipientEmail: trustedEmail,
      recoveryLinkUrl: 'https://rzp.io/i/test123',
    });

    expect(spyProvider.sendReminder).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: trustedEmail })
    );
  });

  it('4. Trusted recovery link — notification receives RecoveryCase recoveryLinkUrl', async () => {
    const spyProvider: EmailProvider = {
      sendReminder: jest.fn().mockResolvedValue({ success: true, provider: 'spy', messageId: 'spy_1' }),
    };
    const service = new NotificationService(spyProvider);

    const trustedLink = 'https://rzp.io/i/trusted_link_456';
    await service.sendRecoveryReminder({
      recipientEmail: 'customer@example.com',
      recoveryLinkUrl: trustedLink,
    });

    expect(spyProvider.sendReminder).toHaveBeenCalledWith(
      expect.objectContaining({ recoveryLinkUrl: trustedLink })
    );
  });

  it('5. Missing recipient email or recovery link returns structured validation error', async () => {
    const service = new NotificationService();

    const resultNoEmail = await service.sendRecoveryReminder({
      recipientEmail: '',
      recoveryLinkUrl: 'https://rzp.io/i/test123',
    });

    expect(resultNoEmail.success).toBe(false);
    expect(resultNoEmail.error).toContain('Recipient email is missing');

    const resultNoLink = await service.sendRecoveryReminder({
      recipientEmail: 'test@example.com',
      recoveryLinkUrl: '',
    });

    expect(resultNoLink.success).toBe(false);
    expect(resultNoLink.error).toContain('Recovery link URL is missing');
  });
});
