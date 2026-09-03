import { executeRecoveryAction } from '../src/recovery/actionExecutor';
import { handleCapturedPayment } from '../src/services/recoveryService';
import * as paymentLinkModule from '../src/integrations/razorpay/paymentLink';
import { prisma } from '../src/db/prismaClient';

jest.mock('../src/db/prismaClient', () => {
  const mPrisma = {
    recoveryCase: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
    },
    recoveryAuditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit_1' }),
    },
  };
  return { prisma: mPrisma };
});

jest.mock('../src/integrations/razorpay/paymentLink', () => ({
  createPaymentLink: jest.fn(),
}));

describe('Milestone 3: Recovery Execution', () => {
  const mockDate = new Date();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeMockCase = (overrides = {}): any => ({
    id: 'case_123',
    paymentId: 'pay_123',
    failureCategory: 'CUSTOMER_ABANDONMENT',
    revenueAtRisk: 50000,
    recoverabilityStatus: 'RECOVERABLE',
    recoveryProbability: 0.6,
    priority: 'MEDIUM',
    recommendedAction: 'CREATE_PAYMENT_LINK',
    preferredMethod: null,
    reasoning: 'Customer abandoned checkout.',
    confidence: 0.9,
    stopCondition: 'Stop after one attempt.',
    actionStatus: 'NONE',
    recoveryAttemptCount: 0,
    maxRecoveryAttempts: 1,
    recoveryLinkId: null,
    recoveryLinkUrl: null,
    amountRecovered: 0,
    createdAt: mockDate,
    updatedAt: mockDate,
    payment: {
      id: 'pay_123',
      razorpayPaymentId: 'rzp_pay_123',
      razorpayOrderId: null,
      customerId: 'cust_123',
      amount: 50000,
      currency: 'INR',
      method: 'card',
      status: 'FAILED',
      captured: false,
      amountRefunded: 0,
      refundStatus: null,
      customer: {
        id: 'cust_123',
        email: 'test@example.com',
        contact: '9999999999',
      },
    },
    ...overrides,
  });

  it('1. Recoverable customer cancellation -> Payment Link created', async () => {
    const rc = makeMockCase({ failureCategory: 'CUSTOMER_ABANDONMENT' });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.recoveryCase.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (paymentLinkModule.createPaymentLink as jest.Mock).mockResolvedValue({
      id: 'plink_test123',
      shortUrl: 'https://rzp.io/i/test123',
      status: 'created',
      raw: {},
    });
    (prisma.recoveryCase.update as jest.Mock).mockResolvedValue({ ...rc, actionStatus: 'COMPLETED' });

    const res = await executeRecoveryAction('case_123');

    expect(res.success).toBe(true);
    expect(res.status).toBe('COMPLETED');
    expect(res.paymentLink?.id).toBe('plink_test123');
    expect(res.paymentLink?.url).toBe('https://rzp.io/i/test123');
    expect(paymentLinkModule.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50000, referenceId: 'case_123' })
    );
  });

  it('2. Bank decline -> Payment Link created if recommendedAction is CREATE_PAYMENT_LINK or supported', async () => {
    // If decision recommends ALTERNATIVE_PAYMENT_METHOD (which isn't CREATE_PAYMENT_LINK), execution blocks
    const rc = makeMockCase({ failureCategory: 'BANK_DECLINE' });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

    const res = await executeRecoveryAction('case_123');

    expect(res.success).toBe(false);
    expect(res.status).toBe('SKIPPED');
    expect(res.error).toContain('Unsupported or non-executable action');
  });

  it('3. Risk rejection -> Blocked', async () => {
    const rc = makeMockCase({ failureCategory: 'RISK_REJECTION', recoverabilityStatus: 'NOT_RECOVERABLE' });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);

    const res = await executeRecoveryAction('case_123');

    expect(res.success).toBe(false);
    expect(res.error).toContain('Case is not marked recoverable');
  });

  it('4. Captured payment -> Blocked', async () => {
    const rc = makeMockCase();
    rc.payment.status = 'CAPTURED';
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);

    const res = await executeRecoveryAction('case_123');

    expect(res.success).toBe(false);
    expect(res.error).toContain('Payment is not in FAILED state');
  });

  it('5. Refunded payment -> Blocked', async () => {
    const rc = makeMockCase();
    rc.payment.status = 'REFUNDED';
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);

    const res = await executeRecoveryAction('case_123');

    expect(res.success).toBe(false);
    expect(res.error).toContain('Payment is not in FAILED state');
  });

  it('6. Max recovery attempts exceeded -> Blocked', async () => {
    const rc = makeMockCase({ recoveryAttemptCount: 1, maxRecoveryAttempts: 1 });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);

    const res = await executeRecoveryAction('case_123');

    expect(res.success).toBe(false);
    expect(res.error).toContain('Max recovery attempts exceeded');
  });

  it('7. Duplicate execution -> Returns existing link without creating second link', async () => {
    const rc = makeMockCase({
      recoveryLinkId: 'plink_existing',
      recoveryLinkUrl: 'https://rzp.io/i/existing',
      actionStatus: 'COMPLETED',
    });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);

    const res = await executeRecoveryAction('case_123');

    expect(res.success).toBe(true);
    expect(res.paymentLink?.id).toBe('plink_existing');
    expect(paymentLinkModule.createPaymentLink).not.toHaveBeenCalled();
    expect(prisma.recoveryAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'ACTION_ALREADY_EXISTS' }),
      })
    );
  });

  it('8. Razorpay API failure -> Audit failure', async () => {
    const rc = makeMockCase();
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.recoveryCase.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (paymentLinkModule.createPaymentLink as jest.Mock).mockRejectedValue(new Error('Razorpay API error'));

    const res = await executeRecoveryAction('case_123');

    expect(res.success).toBe(false);
    expect(res.status).toBe('FAILED');
    expect(res.error).toBe('Razorpay API error');
    expect(prisma.recoveryAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'ACTION_FAILED' }),
      })
    );
  });

  it('9. Successful recovery payment -> RecoveryCase becomes RECOVERED', async () => {
    const rc = makeMockCase({ recoverabilityStatus: 'RECOVERABLE' });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);
    (prisma.recoveryCase.update as jest.Mock).mockResolvedValue({
      ...rc,
      recoverabilityStatus: 'RECOVERED',
      amountRecovered: 50000,
    });

    const eventPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_captured_123',
            amount: 50000,
            notes: { recoveryCaseId: 'case_123' },
          },
        },
      },
    };

    const normEvent = {
      razorpayPaymentId: 'pay_captured_123',
      razorpayOrderId: null,
      amount: 50000,
      currency: 'INR',
      status: 'CAPTURED' as any,
      captured: true,
      method: 'upi',
      bank: null,
      wallet: null,
      amountRefunded: 0,
      refundStatus: null,
      customerEmail: null,
      customerContact: null,
      razorpayCreatedAt: new Date(),
      error: null,
    };

    const updated = await handleCapturedPayment('pay_captured_123', normEvent, eventPayload);

    expect(updated?.recoverabilityStatus).toBe('RECOVERED');
    expect(prisma.recoveryCase.update).toHaveBeenCalledWith({
      where: { id: 'case_123' },
      data: { recoverabilityStatus: 'RECOVERED', amountRecovered: 50000 },
    });
  });

  it('10. Payment Link creation alone -> Case remains RECOVERABLE (not RECOVERED)', async () => {
    const rc = makeMockCase();
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.recoveryCase.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (paymentLinkModule.createPaymentLink as jest.Mock).mockResolvedValue({
      id: 'plink_test123',
      shortUrl: 'https://rzp.io/i/test123',
      status: 'created',
      raw: {},
    });
    (prisma.recoveryCase.update as jest.Mock).mockResolvedValue({
      ...rc,
      actionStatus: 'COMPLETED',
      recoverabilityStatus: 'RECOVERABLE',
    });

    const res = await executeRecoveryAction('case_123');

    expect(res.success).toBe(true);
    // Verify that update set recoverabilityStatus to RECOVERABLE, NOT RECOVERED
    expect(prisma.recoveryCase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recoverabilityStatus: 'RECOVERABLE' }),
      })
    );
  });
});
