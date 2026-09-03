import { buildRecoveryContext, calculateBaselineProbability } from '../src/recovery/contextBuilder';
import { RecoveryContextSchema } from '../src/recovery/schemas/recoveryContextSchema';
import { prisma } from '../src/db/prismaClient';
import { FailureCategory } from '@prisma/client';

jest.mock('../src/db/prismaClient', () => {
  const mPrisma = {
    recoveryCase: {
      findUnique: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
    },
  };
  return { prisma: mPrisma };
});

describe('Phase 2C — Recovery Context Contract & Context Builder', () => {
  const baseTime = new Date('2026-09-03T12:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeMockRecoveryCase = (overrides: any = {}) => ({
    id: 'case_123',
    paymentId: 'pay_current',
    failureCategory: 'BANK_DECLINE' as FailureCategory,
    revenueAtRisk: 50000,
    recoverabilityStatus: 'PENDING_ASSESSMENT',
    recoveryAttemptCount: 0,
    maxRecoveryAttempts: 3,
    recoveryLinkUrl: null,
    createdAt: baseTime,
    updatedAt: baseTime,
    payment: {
      id: 'pay_current',
      razorpayPaymentId: 'rzp_pay_current',
      razorpayOrderId: 'order_123',
      customerId: 'cust_100',
      amount: 50000,
      currency: 'INR',
      method: 'card',
      bank: 'HDFC',
      wallet: null,
      status: 'FAILED',
      captured: false,
      errorCode: 'BAD_REQUEST_ERROR',
      errorDescription: 'Payment failed due to bank decline',
      errorSource: 'bank',
      errorStep: 'payment_authorization',
      errorReason: 'payment_failed',
      razorpayCreatedAt: baseTime,
      createdAt: baseTime,
      customer: {
        id: 'cust_100',
        email: 'user@example.com',
        contact: '+919999999999',
      },
    },
    auditLogs: [
      { id: 'log_1', action: 'ASSESSMENT_COMPLETED', status: 'COMPLETED', createdAt: baseTime },
    ],
    ...overrides,
  });

  // ── Test 1: Customer with previous successful and failed payments ──────────
  it('1. Calculates customer history metrics for customer with prior payments', async () => {
    const mockCase = makeMockRecoveryCase();
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(mockCase);

    const t1 = new Date('2026-08-01T12:00:00Z'); // 33 days before baseTime
    const t2 = new Date('2026-08-15T12:00:00Z');

    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      { id: 'pay_past1', status: 'CAPTURED', amount: 100000, razorpayCreatedAt: t1, createdAt: t1 },
      { id: 'pay_past2', status: 'FAILED', amount: 50000, razorpayCreatedAt: t2, createdAt: t2 },
      { id: 'pay_current', status: 'FAILED', amount: 50000, razorpayCreatedAt: baseTime, createdAt: baseTime },
    ]);

    const context = await buildRecoveryContext('case_123', new Date('2026-09-03T13:00:00Z')); // 60 mins age

    expect(context.customer.totalSuccessfulPayments).toBe(1);
    expect(context.customer.totalFailedPayments).toBe(1);
    expect(context.customer.lifetimeValue).toBe(100000);
    expect(context.customer.averageOrderValue).toBe(100000);
    expect(context.customer.tenureDays).toBe(33);
  });

  // ── Test 2: New customer with no previous payment history ───────────────────
  it('2. Handles new customer with no prior payment history', async () => {
    const mockCase = makeMockRecoveryCase();
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(mockCase);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      { id: 'pay_current', status: 'FAILED', amount: 50000, razorpayCreatedAt: baseTime, createdAt: baseTime },
    ]);

    const context = await buildRecoveryContext('case_123', baseTime);

    expect(context.customer.totalSuccessfulPayments).toBe(0);
    expect(context.customer.totalFailedPayments).toBe(0);
    expect(context.customer.lifetimeValue).toBe(0);
    expect(context.customer.averageOrderValue).toBe(0);
    expect(context.customer.tenureDays).toBe(0);
  });

  // ── Test 3: Current failed payment excluded from historical metrics ─────────
  it('3. Strictly excludes current payment and future payments using failure timestamp cutoff', async () => {
    const mockCase = makeMockRecoveryCase();
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(mockCase);

    const pastTime = new Date('2026-09-01T12:00:00Z');
    const futureTime = new Date('2026-09-04T12:00:00Z'); // after failure cutoff

    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      { id: 'pay_past', status: 'CAPTURED', amount: 40000, razorpayCreatedAt: pastTime, createdAt: pastTime },
      { id: 'pay_current', status: 'FAILED', amount: 50000, razorpayCreatedAt: baseTime, createdAt: baseTime },
      { id: 'pay_future', status: 'CAPTURED', amount: 90000, razorpayCreatedAt: futureTime, createdAt: futureTime },
    ]);

    const context = await buildRecoveryContext('case_123', baseTime);

    expect(context.customer.totalSuccessfulPayments).toBe(1);
    expect(context.customer.lifetimeValue).toBe(40000);
  });

  // ── Test 4: Existing recovery audit actions mapped correctly ───────────────
  it('4. Maps existing audit logs into previousActionsThisCase array', async () => {
    const mockCase = makeMockRecoveryCase({
      auditLogs: [
        { id: 'log_1', action: 'ASSESSMENT_COMPLETED', status: 'COMPLETED' },
        { id: 'log_2', action: 'SEND_RETRY_LINK', status: 'FAILED' },
      ],
    });
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(mockCase);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

    const context = await buildRecoveryContext('case_123', baseTime);

    expect(context.recovery.previousActionsThisCase).toEqual([
      { action: 'ASSESSMENT_COMPLETED', result: 'COMPLETED' },
      { action: 'SEND_RETRY_LINK', result: 'FAILED' },
    ]);
  });

  // ── Test 5: Expired/near-expiry recovery window ────────────────────────────
  it('5. Clamps recoveryWindowRemainingMinutes to 0 when recovery window expires', async () => {
    const mockCase = makeMockRecoveryCase();
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(mockCase);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

    // 1500 minutes after failure (default window is 1440 minutes)
    const futureNow = new Date(baseTime.getTime() + 1500 * 60 * 1000);

    const context = await buildRecoveryContext('case_123', futureNow);

    expect(context.recovery.caseAgeMinutes).toBe(1500);
    expect(context.policy.recoveryWindowRemainingMinutes).toBe(0);
  });

  // ── Test 6: PII is absent from generated context ───────────────────────────
  it('6. Ensures zero PII (email, contact, raw payloads) in returned context', async () => {
    const mockCase = makeMockRecoveryCase();
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(mockCase);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

    const context = await buildRecoveryContext('case_123', baseTime);
    const contextJson = JSON.stringify(context);

    expect(contextJson).not.toContain('user@example.com');
    expect(contextJson).not.toContain('+919999999999');
    expect(context.customer).toHaveProperty('hasEmail', true);
    expect(context.customer).toHaveProperty('hasContact', true);
    expect(context.customer).not.toHaveProperty('email');
    expect(context.customer).not.toHaveProperty('contact');
  });

  // ── Test 7: RecoveryContext schema validation ──────────────────────────────
  it('7. Validates constructed object with RecoveryContextSchema and throws on invalid structure', async () => {
    const mockCase = makeMockRecoveryCase();
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(mockCase);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

    const context = await buildRecoveryContext('case_123', baseTime);

    // Schema parse should succeed on valid context
    expect(() => RecoveryContextSchema.parse(context)).not.toThrow();

    // Invalid object missing required fields should throw
    expect(() => RecoveryContextSchema.parse({ schemaVersion: 1, payment: {} })).toThrow();
  });

  // ── Test 8: Baseline probability bounds ────────────────────────────────────
  it('8. Ensures baselineRecoveryProbability remains bounded between 0.0 and 1.0', () => {
    const categories: FailureCategory[] = [
      'CUSTOMER_ABANDONMENT', 'BANK_DECLINE', 'GATEWAY_FAILURE',
      'AUTHENTICATION_FAILURE', 'INSUFFICIENT_FUNDS', 'INVALID_PAYMENT_DETAILS',
      'TIMEOUT', 'RISK_REJECTION', 'UNKNOWN',
    ];

    for (const cat of categories) {
      const probHigh = calculateBaselineProbability(cat, 100, 0, 0, 1000);
      const probLow = calculateBaselineProbability(cat, 0, 10, 5, 0);

      expect(probHigh).toBeGreaterThanOrEqual(0.0);
      expect(probHigh).toBeLessThanOrEqual(1.0);
      expect(probLow).toBeGreaterThanOrEqual(0.0);
      expect(probLow).toBeLessThanOrEqual(1.0);
    }
  });

  // ── Test 9: Missing RecoveryCase / Payment relationship ────────────────────
  it('9. Throws error deterministically when RecoveryCase or associated Payment is not found', async () => {
    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(buildRecoveryContext('non_existent_id')).rejects.toThrow(
      'RecoveryCase or associated Payment not found'
    );
  });

  // ── Test 10: Null optional Razorpay fields ──────────────────────────────────
  it('10. Validates successfully when optional Razorpay fields are null', async () => {
    const mockCase = makeMockRecoveryCase({
      payment: {
        id: 'pay_nulls',
        razorpayPaymentId: 'rzp_pay_nulls',
        razorpayOrderId: null,
        customerId: null,
        amount: 25000,
        currency: 'INR',
        method: null,
        bank: null,
        wallet: null,
        status: 'FAILED',
        captured: false,
        errorCode: null,
        errorDescription: null,
        errorSource: null,
        errorStep: null,
        errorReason: null,
        razorpayCreatedAt: baseTime,
        createdAt: baseTime,
        customer: null,
      },
    });

    (prisma.recoveryCase.findUnique as jest.Mock).mockResolvedValue(mockCase);

    const context = await buildRecoveryContext('case_123', baseTime);

    expect(context.payment.razorpayOrderId).toBeNull();
    expect(context.payment.bank).toBeNull();
    expect(context.payment.wallet).toBeNull();
    expect(context.failure.errorCode).toBeNull();
    expect(context.customer.hasEmail).toBe(false);
    expect(context.customer.hasContact).toBe(false);
    expect(() => RecoveryContextSchema.parse(context)).not.toThrow();
  });
});
