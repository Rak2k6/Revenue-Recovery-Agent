/**
 * recoveryExecution.test.ts
 *
 * Updated for Phase 2F: executeRecoveryAction now accepts (recoveryCaseId, policyDecision, context).
 * All pre-existing behaviour assertions are preserved; only the call signature changes.
 */
import { executeRecoveryAction } from '../src/recovery/actionExecutor';
import { handleCapturedPayment } from '../src/services/recoveryService';
import * as paymentLinkModule from '../src/integrations/razorpay/paymentLink';
import { prisma } from '../src/db/prismaClient';
import { PolicyDecision } from '../src/recovery/schemas/policyDecisionSchema';
import { RecoveryContext } from '../src/recovery/schemas/recoveryContextSchema';

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

// ---------------------------------------------------------------------------
// Shared fixture builders
// ---------------------------------------------------------------------------

function makeApprovedPolicy(overrides: Partial<PolicyDecision> = {}): PolicyDecision {
  return {
    schemaVersion: 1,
    approved: true,
    action: 'CREATE_PAYMENT_LINK',
    reason: 'Recovery action is permitted under the current policy constraints.',
    stopCondition: null,
    ...overrides,
  };
}

function makeContext(): RecoveryContext {
  return {
    schemaVersion: 1,
    payment: {
      razorpayPaymentId: 'rzp_pay_123',
      razorpayOrderId: null,
      amount: 50000,
      currency: 'INR',
      method: 'card',
      bank: null,
      wallet: null,
      status: 'FAILED',
      razorpayCreatedAt: new Date().toISOString(),
    },
    failure: {
      category: 'CUSTOMER_ABANDONMENT',
      errorCode: null,
      errorDescription: null,
      errorSource: null,
      errorStep: null,
      errorReason: null,
    },
    customer: {
      tenureDays: 10,
      totalSuccessfulPayments: 0,
      totalFailedPayments: 0,
      lifetimeValue: 0,
      averageOrderValue: 0,
      hasEmail: true,
      hasContact: true,
    },
    recovery: {
      recoveryAttemptCount: 0,
      maxRecoveryAttempts: 3,
      attemptsRemaining: 3,
      previousActionsThisCase: [],
      existingRecoveryLinkUrl: null,
      caseAgeMinutes: 10,
      revenueAtRisk: 50000,
      baselineRecoveryProbability: 0.60,
    },
    policy: {
      recoveryWindowRemainingMinutes: 1400,
      withinContactLimit: true,
      isHighValue: false,
    },
  };
}

const mockDate = new Date();

function makeMockCase(overrides: Record<string, unknown> = {}): any {
  return {
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
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Milestone 3: Recovery Execution (Phase 2F)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. Recoverable customer cancellation -> Payment Link created', async () => {
    const rc = makeMockCase({ failureCategory: 'CUSTOMER_ABANDONMENT', maxRecoveryAttempts: 3 });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);
    (prisma.recoveryCase.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (paymentLinkModule.createPaymentLink as jest.Mock).mockResolvedValue({
      id: 'plink_test123',
      shortUrl: 'https://rzp.io/i/test123',
      status: 'created',
      raw: {},
    });
    (prisma.recoveryCase.update as jest.Mock).mockResolvedValue({ ...rc, actionStatus: 'COMPLETED' });

    const res = await executeRecoveryAction('case_123', makeApprovedPolicy(), makeContext());

    expect(res.success).toBe(true);
    expect(res.status).toBe('COMPLETED');
    expect(res.paymentLink?.id).toBe('plink_test123');
    expect(res.paymentLink?.url).toBe('https://rzp.io/i/test123');
    expect(paymentLinkModule.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50000, referenceId: 'case_123' })
    );
  });

  it('2. Rejected policy decision -> no Razorpay call', async () => {
    const policy = makeApprovedPolicy({
      approved: false,
      action: 'STOP',
      stopCondition: 'RISK_REJECTED',
      reason: 'Risk rejection.',
    });

    const res = await executeRecoveryAction('case_123', policy, makeContext());

    expect(res.success).toBe(false);
    expect(res.status).toBe('SKIPPED');
    expect(paymentLinkModule.createPaymentLink).not.toHaveBeenCalled();
    // Must write an EXECUTION_REJECTED audit log
    expect(prisma.recoveryAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'EXECUTION_REJECTED' }),
      })
    );
  });

  it('3. RISK_REJECTION policy -> no execution side effects', async () => {
    const policy = makeApprovedPolicy({
      approved: false,
      action: 'STOP',
      stopCondition: 'RISK_REJECTED',
      reason: 'Risk rejection cannot be bypassed.',
    });

    const res = await executeRecoveryAction('case_123', policy, makeContext());

    expect(res.success).toBe(false);
    expect(paymentLinkModule.createPaymentLink).not.toHaveBeenCalled();
    expect(prisma.recoveryCase.findUnique).not.toHaveBeenCalled(); // must not even touch DB
  });

  it('4. Captured payment (stale state) -> blocked by executor invariant', async () => {
    const rc = makeMockCase({ maxRecoveryAttempts: 3 });
    rc.payment.status = 'CAPTURED';
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);

    const res = await executeRecoveryAction('case_123', makeApprovedPolicy(), makeContext());

    expect(res.success).toBe(false);
    expect(res.error).toContain('Payment is not in FAILED state');
    expect(paymentLinkModule.createPaymentLink).not.toHaveBeenCalled();
  });

  it('5. Refunded payment -> blocked by executor invariant', async () => {
    const rc = makeMockCase({ maxRecoveryAttempts: 3 });
    rc.payment.status = 'REFUNDED';
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);

    const res = await executeRecoveryAction('case_123', makeApprovedPolicy(), makeContext());

    expect(res.success).toBe(false);
    expect(res.error).toContain('Payment is not in FAILED state');
  });

  it('6. Max recovery attempts exceeded (stale state) -> blocked', async () => {
    const rc = makeMockCase({ recoveryAttemptCount: 1, maxRecoveryAttempts: 1 });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);

    const res = await executeRecoveryAction('case_123', makeApprovedPolicy(), makeContext());

    expect(res.success).toBe(false);
    expect(res.error).toContain('Max recovery attempts exceeded');
    expect(paymentLinkModule.createPaymentLink).not.toHaveBeenCalled();
  });

  it('7. Duplicate execution -> returns existing link without creating second link', async () => {
    const rc = makeMockCase({
      recoveryLinkId: 'plink_existing',
      recoveryLinkUrl: 'https://rzp.io/i/existing',
      actionStatus: 'COMPLETED',
      maxRecoveryAttempts: 3,
    });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);

    const res = await executeRecoveryAction('case_123', makeApprovedPolicy(), makeContext());

    expect(res.success).toBe(true);
    expect(res.paymentLink?.id).toBe('plink_existing');
    expect(paymentLinkModule.createPaymentLink).not.toHaveBeenCalled();
    expect(prisma.recoveryAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'ACTION_ALREADY_EXISTS' }),
      })
    );
  });

  it('8. Razorpay API failure -> audit failure, no crash', async () => {
    const rc = makeMockCase({ maxRecoveryAttempts: 3 });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);
    (prisma.recoveryCase.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (paymentLinkModule.createPaymentLink as jest.Mock).mockRejectedValue(new Error('Razorpay API error'));
    (prisma.recoveryCase.update as jest.Mock).mockResolvedValue({ ...rc });

    const res = await executeRecoveryAction('case_123', makeApprovedPolicy(), makeContext());

    expect(res.success).toBe(false);
    expect(res.status).toBe('FAILED');
    expect(res.error).toBe('Razorpay API error');
    expect(prisma.recoveryAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'ACTION_FAILED' }),
      })
    );
  });

  it('9. Successful recovery payment -> RecoveryCase becomes RECOVERED (via handleCapturedPayment)', async () => {
    const rc = makeMockCase({ recoverabilityStatus: 'RECOVERABLE' });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);
    (prisma.recoveryCase.update as jest.Mock).mockResolvedValue({
      ...rc,
      recoverabilityStatus: 'RECOVERED',
      amountRecovered: 50000,
    });

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

    const updated = await handleCapturedPayment('pay_captured_123', normEvent, eventPayload);

    expect(updated?.recoverabilityStatus).toBe('RECOVERED');
    expect(prisma.recoveryCase.update).toHaveBeenCalledWith({
      where: { id: 'case_123' },
      data: { recoverabilityStatus: 'RECOVERED', amountRecovered: 50000 },
    });
  });

  it('10. Payment Link creation -> Case remains RECOVERABLE (not RECOVERED)', async () => {
    const rc = makeMockCase({ maxRecoveryAttempts: 3 });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);
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

    const res = await executeRecoveryAction('case_123', makeApprovedPolicy(), makeContext());

    expect(res.success).toBe(true);
    expect(prisma.recoveryCase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recoverabilityStatus: 'RECOVERABLE' }),
      })
    );
  });

  it('11. NO_ACTION policy decision -> no Razorpay call, success=true', async () => {
    const policy = makeApprovedPolicy({ approved: false, action: 'NO_ACTION', stopCondition: null, reason: 'No action required.' });

    const res = await executeRecoveryAction('case_123', policy, makeContext());

    expect(paymentLinkModule.createPaymentLink).not.toHaveBeenCalled();
    expect(res.action).toBe('NO_ACTION');
  });

  it('12. STOP policy decision -> no Razorpay call', async () => {
    const policy = makeApprovedPolicy({
      approved: false,
      action: 'STOP',
      stopCondition: 'LOW_CONFIDENCE',
      reason: 'Confidence too low.',
    });

    const res = await executeRecoveryAction('case_123', policy, makeContext());

    expect(paymentLinkModule.createPaymentLink).not.toHaveBeenCalled();
    expect(res.action).toBe('STOP');
    expect(res.success).toBe(false);
  });

  it('13. Amount comes from RecoveryCase, not from LLM context recovery_probability', async () => {
    const rc = makeMockCase({ revenueAtRisk: 99999, maxRecoveryAttempts: 3 });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);
    (prisma.recoveryCase.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (paymentLinkModule.createPaymentLink as jest.Mock).mockResolvedValue({
      id: 'plink_t1',
      shortUrl: 'https://rzp.io/i/t1',
      status: 'created',
      raw: {},
    });
    (prisma.recoveryCase.update as jest.Mock).mockResolvedValue({ ...rc });

    // Context deliberately has a different revenueAtRisk; executor must use RecoveryCase amount
    const ctx = makeContext();
    ctx.recovery.revenueAtRisk = 1; // intentionally wrong — should be ignored

    await executeRecoveryAction('case_123', makeApprovedPolicy(), ctx);

    // Amount passed to Razorpay must be from the DB record (99999), not from context (1)
    expect(paymentLinkModule.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 99999 })
    );
  });

  it('14. Concurrent execution -> second claim returns existing result', async () => {
    const rc = makeMockCase({ maxRecoveryAttempts: 3 });
    (prisma.recoveryCase.findUnique as jest.Mock)
      .mockResolvedValueOnce(rc)
      .mockResolvedValueOnce({
        ...rc,
        recoveryLinkId: 'plink_concurrent',
        recoveryLinkUrl: 'https://rzp.io/i/concurrent',
      });
    // updateMany returns 0 → another process claimed it
    (prisma.recoveryCase.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    const res = await executeRecoveryAction('case_123', makeApprovedPolicy(), makeContext());

    expect(paymentLinkModule.createPaymentLink).not.toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.paymentLink?.id).toBe('plink_concurrent');
  });

  it('15. No PII from LLM reaches Razorpay — customer details come from payment record only', async () => {
    const rc = makeMockCase({ maxRecoveryAttempts: 3 });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(rc);
    (prisma.recoveryCase.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (paymentLinkModule.createPaymentLink as jest.Mock).mockResolvedValue({
      id: 'plink_t2',
      shortUrl: 'https://rzp.io/i/t2',
      status: 'created',
      raw: {},
    });
    (prisma.recoveryCase.update as jest.Mock).mockResolvedValue({ ...rc });

    await executeRecoveryAction('case_123', makeApprovedPolicy(), makeContext());

    // email/contact must come from rc.payment.customer, not from context
    expect(paymentLinkModule.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: 'test@example.com',
        customerContact: '9999999999',
      })
    );
  });
});
