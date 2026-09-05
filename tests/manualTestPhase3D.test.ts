import { executeRecoveryAction } from '../src/recovery/actionExecutor';
import { NotificationService } from '../src/integrations/notifications/notificationService';
import { MockEmailProvider } from '../src/integrations/notifications/mockEmailProvider';
import { PolicyDecision } from '../src/recovery/schemas/policyDecisionSchema';
import { RecoveryContext } from '../src/recovery/schemas/recoveryContextSchema';

// Mocks for DB operations in manual verification script
jest.mock('../src/db/prismaClient', () => {
  const cases = new Map<string, any>();
  const auditLogs: any[] = [];

  const mPrisma = {
    recoveryCase: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => cases.get(where.id) || null),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const existing = cases.get(where.id) || {};
        const updated = { ...existing, ...data };
        cases.set(where.id, updated);
        return updated;
      }),
    },
    recoveryAuditLog: {
      create: jest.fn(async ({ data }: { data: any }) => {
        auditLogs.push(data);
        return { id: `audit_${auditLogs.length}`, ...data };
      }),
    },
    _cases: cases,
    _auditLogs: auditLogs,
  };
  return { prisma: mPrisma };
});

import { prisma } from '../src/db/prismaClient';

function makeBaseContext(): RecoveryContext {
  return {
    schemaVersion: 1,
    payment: {
      razorpayPaymentId: 'rzp_pay_manual_3d',
      razorpayOrderId: null,
      amount: 150000,
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
      tenureDays: 30,
      totalSuccessfulPayments: 2,
      totalFailedPayments: 1,
      lifetimeValue: 300000,
      averageOrderValue: 150000,
      hasEmail: true,
      hasContact: true,
    },
    recovery: {
      recoveryAttemptCount: 1,
      maxRecoveryAttempts: 3,
      attemptsRemaining: 2,
      previousActionsThisCase: [{ action: 'CREATE_PAYMENT_LINK', result: 'COMPLETED' }],
      existingRecoveryLinkUrl: 'https://rzp.io/i/manual_test_link',
      caseAgeMinutes: 60,
      revenueAtRisk: 150000,
      baselineRecoveryProbability: 0.75,
    },
    policy: {
      recoveryWindowRemainingMinutes: 1340,
      withinContactLimit: true,
      isHighValue: true,
    },
  };
}

function makeDbCase(overrides: any = {}) {
  return {
    id: 'case_manual_3d',
    paymentId: 'pay_manual_3d',
    failureCategory: 'CUSTOMER_ABANDONMENT',
    revenueAtRisk: 150000,
    recoverabilityStatus: 'RECOVERABLE',
    recoveryProbability: 0.75,
    priority: 'HIGH',
    recommendedAction: 'SEND_RECOVERY_REMINDER',
    actionStatus: 'NONE',
    recoveryAttemptCount: 1,
    maxRecoveryAttempts: 3,
    recoveryLinkId: 'plink_manual_123',
    recoveryLinkUrl: 'https://rzp.io/i/manual_test_link',
    amountRecovered: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    payment: {
      id: 'pay_manual_3d',
      razorpayPaymentId: 'rzp_pay_manual_3d',
      razorpayOrderId: null,
      customerId: 'cust_manual_3d',
      amount: 150000,
      currency: 'INR',
      method: 'card',
      status: 'FAILED',
      captured: false,
      amountRefunded: 0,
      customer: {
        id: 'cust_manual_3d',
        email: 'customer@manualtest.com',
        contact: '9876543210',
      },
    },
    ...overrides,
  };
}

describe('Phase 3D — Manual Verification Scenarios', () => {

  beforeEach(() => {
    (prisma as any)._cases.clear();
    (prisma as any)._auditLogs.length = 0;
  });

  it('Scenario A — Reminder Success', async () => {
    const rc = makeDbCase();
    (prisma as any)._cases.set(rc.id, rc);

    const mockProvider = new MockEmailProvider({ shouldFail: false });
    const notificationService = new NotificationService(mockProvider);

    const approvedPolicy: PolicyDecision = {
      schemaVersion: 1,
      approved: true,
      action: 'SEND_RECOVERY_REMINDER',
      reason: 'Approved follow up reminder for existing link.',
      stopCondition: null,
    };

    const res = await executeRecoveryAction(rc.id, approvedPolicy, makeBaseContext(), notificationService);

    expect(res.success).toBe(true);
    expect(res.status).toBe('COMPLETED');

    const updatedCase = (prisma as any)._cases.get(rc.id);
    expect(updatedCase.actionStatus).toBe('COMPLETED');
    expect(updatedCase.amountRecovered).toBe(0); // amountRecovered MUST NOT change
    expect(updatedCase.recoverabilityStatus).toBe('RECOVERABLE'); // recoverabilityStatus MUST NOT become RECOVERED
    expect(updatedCase.recoveryAttemptCount).toBe(1); // recoveryAttemptCount MUST NOT change for reminder

    const audit = (prisma as any)._auditLogs.find((l: any) => l.action === 'RECOVERY_REMINDER_SENT');
    expect(audit).toBeDefined();
    expect(audit.status).toBe('COMPLETED');
    expect(audit.metadata.provider).toBe('mock');
  });

  it('Scenario B — Reminder Failure', async () => {
    const rc = makeDbCase();
    (prisma as any)._cases.set(rc.id, rc);

    const mockProvider = new MockEmailProvider({ shouldFail: true, failureReason: 'Provider offline' });
    const notificationService = new NotificationService(mockProvider);

    const approvedPolicy: PolicyDecision = {
      schemaVersion: 1,
      approved: true,
      action: 'SEND_RECOVERY_REMINDER',
      reason: 'Approved follow up reminder.',
      stopCondition: null,
    };

    const res = await executeRecoveryAction(rc.id, approvedPolicy, makeBaseContext(), notificationService);

    expect(res.success).toBe(false);
    expect(res.status).toBe('FAILED');

    const updatedCase = (prisma as any)._cases.get(rc.id);
    expect(updatedCase.actionStatus).toBe('FAILED');
    expect(updatedCase.amountRecovered).toBe(0);
    expect(updatedCase.recoverabilityStatus).toBe('RECOVERABLE');
    expect(updatedCase.recoveryAttemptCount).toBe(1);

    const audit = (prisma as any)._auditLogs.find((l: any) => l.action === 'RECOVERY_REMINDER_FAILED');
    expect(audit).toBeDefined();
    expect(audit.status).toBe('FAILED');
    expect(audit.metadata.reason).toBe('Provider offline');
  });

  it('Scenario C — No Recovery Link', async () => {
    const rc = makeDbCase({ recoveryLinkUrl: null });
    (prisma as any)._cases.set(rc.id, rc);

    const spyProvider = { sendReminder: jest.fn() };
    const notificationService = new NotificationService(spyProvider);

    const approvedPolicy: PolicyDecision = {
      schemaVersion: 1,
      approved: true,
      action: 'SEND_RECOVERY_REMINDER',
      reason: 'Approved reminder.',
      stopCondition: null,
    };

    const res = await executeRecoveryAction(rc.id, approvedPolicy, makeBaseContext(), notificationService);

    expect(res.success).toBe(false);
    expect(res.status).toBe('SKIPPED');
    expect(spyProvider.sendReminder).not.toHaveBeenCalled();
  });

  it('Scenario D — Policy Rejection', async () => {
    const rc = makeDbCase();
    (prisma as any)._cases.set(rc.id, rc);

    const spyProvider = { sendReminder: jest.fn() };
    const notificationService = new NotificationService(spyProvider);

    const rejectedPolicy: PolicyDecision = {
      schemaVersion: 1,
      approved: false,
      action: 'SEND_RECOVERY_REMINDER',
      reason: 'Risk rejection.',
      stopCondition: 'RISK_REJECTED',
    };

    const res = await executeRecoveryAction(rc.id, rejectedPolicy, makeBaseContext(), notificationService);

    expect(res.success).toBe(false);
    expect(res.status).toBe('SKIPPED');
    expect(spyProvider.sendReminder).not.toHaveBeenCalled();
  });
});
