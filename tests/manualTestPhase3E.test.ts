import { getRecoveryMetrics } from '../src/recovery/recoveryMetrics';

// Mock DB for end-to-end scenario simulation
jest.mock('../src/db/prismaClient', () => {
  const cases: any[] = [];
  const auditLogs: any[] = [];

  const mPrisma = {
    recoveryCase: {
      groupBy: jest.fn(async () => {
        const counts: Record<string, number> = {};
        for (const c of cases) {
          counts[c.recoverabilityStatus] = (counts[c.recoverabilityStatus] || 0) + 1;
        }
        return Object.entries(counts).map(([status, count]) => ({
          recoverabilityStatus: status,
          _count: { _all: count },
        }));
      }),
      aggregate: jest.fn(async () => {
        let totalAtRisk = 0;
        let totalRecovered = 0;
        for (const c of cases) {
          totalAtRisk += c.revenueAtRisk || 0;
          totalRecovered += c.amountRecovered || 0;
        }
        return {
          _sum: {
            revenueAtRisk: totalAtRisk || null,
            amountRecovered: totalRecovered || null,
          },
        };
      }),
    },
    recoveryAuditLog: {
      count: jest.fn(async ({ where }: { where: { action?: string; status?: string } }) => {
        return auditLogs.filter((l) => {
          if (where.action && l.action !== where.action) return false;
          if (where.status && l.status !== where.status) return false;
          return true;
        }).length;
      }),
    },
    _cases: cases,
    _auditLogs: auditLogs,
  };
  return { prisma: mPrisma };
});

import { prisma } from '../src/db/prismaClient';

describe('Phase 3E — Manual Verification Scenario', () => {
  beforeEach(() => {
    (prisma as any)._cases.length = 0;
    (prisma as any)._auditLogs.length = 0;
  });

  it('Step 15 Scenario — End-to-end database aggregate verification', async () => {
    // 1. Process multiple cases:
    // Case 1: Recovered case (link created -> reminder sent -> successful payment captured)
    (prisma as any)._cases.push({
      id: 'case_1',
      revenueAtRisk: 100000,
      amountRecovered: 100000,
      recoverabilityStatus: 'RECOVERED',
    });
    (prisma as any)._auditLogs.push(
      { recoveryCaseId: 'case_1', action: 'PAYMENT_LINK_CREATED', status: 'COMPLETED' },
      { recoveryCaseId: 'case_1', action: 'RECOVERY_REMINDER_SENT', status: 'COMPLETED' },
      { recoveryCaseId: 'case_1', action: 'RECOVERY_SUCCESSFUL', status: 'COMPLETED' }
    );

    // Case 2: Failed/Stopped case (payment link created -> notification failed / policy stop)
    (prisma as any)._cases.push({
      id: 'case_2',
      revenueAtRisk: 50000,
      amountRecovered: 0,
      recoverabilityStatus: 'RECOVERY_FAILED',
    });
    (prisma as any)._auditLogs.push(
      { recoveryCaseId: 'case_2', action: 'PAYMENT_LINK_CREATED', status: 'COMPLETED' },
      { recoveryCaseId: 'case_2', action: 'RECOVERY_REMINDER_FAILED', status: 'FAILED' }
    );

    // Case 3: Recoverable case (batch runner processed -> link created, awaiting payment)
    (prisma as any)._cases.push({
      id: 'case_3',
      revenueAtRisk: 200000,
      amountRecovered: 0,
      recoverabilityStatus: 'RECOVERABLE',
    });
    (prisma as any)._auditLogs.push(
      { recoveryCaseId: 'case_3', action: 'PAYMENT_LINK_CREATED', status: 'COMPLETED' }
    );

    // Case 4: Pending assessment case
    (prisma as any)._cases.push({
      id: 'case_4',
      revenueAtRisk: 150000,
      amountRecovered: 0,
      recoverabilityStatus: 'PENDING_ASSESSMENT',
    });

    const metrics = await getRecoveryMetrics();

    // Verify Case Counts:
    // total = 4 (case_1, case_2, case_3, case_4)
    expect(metrics.cases.total).toBe(4);
    expect(metrics.cases.pending).toBe(1);
    expect(metrics.cases.recoverable).toBe(1);
    expect(metrics.cases.recovered).toBe(1);
    expect(metrics.cases.recoveryFailed).toBe(1);
    expect(metrics.cases.notRecoverable).toBe(0);

    // Verify Revenue Metrics:
    // revenueAtRisk = 100000 + 50000 + 200000 + 150000 = 500000 (paise = ₹5,000)
    // revenueRecovered = 100000 (paise = ₹1,000)
    // revenueRecoveryRate = (100000 / 500000) * 100 = 20.00%
    expect(metrics.revenue.atRisk).toBe(500000);
    expect(metrics.revenue.recovered).toBe(100000);
    expect(metrics.revenue.recoveryRate).toBe(20);

    // Verify Recovery Case Rate:
    // eligibleCases = RECOVERABLE (1) + RECOVERED (1) + RECOVERY_FAILED (1) = 3
    // caseRecoveryRate = (1 / 3) * 100 = 33.33%
    expect(metrics.recovery.eligibleCases).toBe(3);
    expect(metrics.recovery.caseRecoveryRate).toBe(33.33);

    // Verify Action Metrics:
    // paymentLinksCreated = 3
    // remindersSent = 1
    // failed = 1
    // skipped = 0
    expect(metrics.actions.paymentLinksCreated).toBe(3);
    expect(metrics.actions.remindersSent).toBe(1);
    expect(metrics.actions.failed).toBe(1);
    expect(metrics.actions.skipped).toBe(0);
  });
});
