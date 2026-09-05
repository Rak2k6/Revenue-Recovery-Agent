import request from 'supertest';
import { prisma } from '../src/db/prismaClient';

jest.mock('../src/db/prismaClient', () => {
  return {
    prisma: {
      recoveryCase: {
        groupBy: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      recoveryAuditLog: {
        count: jest.fn(),
      },
    },
  };
});

import { getRecoveryMetrics } from '../src/recovery/recoveryMetrics';
import { createApp } from '../src/app';

describe('Phase 3E — Revenue Recovery Metrics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Test 1 — Empty database ────────────────────────────────────────────────
  it('Test 1 — Empty database returns zeroes without NaN or Infinity', async () => {
    (prisma.recoveryCase.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.recoveryCase.aggregate as jest.Mock).mockResolvedValue({
      _sum: { revenueAtRisk: null, amountRecovered: null },
    });
    (prisma.recoveryAuditLog.count as jest.Mock).mockResolvedValue(0);

    const metrics = await getRecoveryMetrics();

    expect(metrics.success).toBe(true);
    expect(metrics.cases).toEqual({
      total: 0,
      pending: 0,
      recoverable: 0,
      recovered: 0,
      recoveryFailed: 0,
      notRecoverable: 0,
    });
    expect(metrics.revenue).toEqual({
      atRisk: 0,
      recovered: 0,
      recoveryRate: 0,
    });
    expect(metrics.recovery).toEqual({
      eligibleCases: 0,
      caseRecoveryRate: 0,
    });
    expect(metrics.actions).toEqual({
      paymentLinksCreated: 0,
      remindersSent: 0,
      failed: 0,
      skipped: 0,
    });
    expect(Number.isNaN(metrics.revenue.recoveryRate)).toBe(false);
    expect(Number.isNaN(metrics.recovery.caseRecoveryRate)).toBe(false);
  });

  // ── Test 2 — Revenue aggregation ─────────────────────────────────────────
  it('Test 2 — Revenue aggregation and recovery rate calculation', async () => {
    (prisma.recoveryCase.groupBy as jest.Mock).mockResolvedValue([
      { recoverabilityStatus: 'RECOVERED', _count: { _all: 1 } },
      { recoverabilityStatus: 'RECOVERABLE', _count: { _all: 1 } },
    ]);
    (prisma.recoveryCase.aggregate as jest.Mock).mockResolvedValue({
      _sum: { revenueAtRisk: 30000, amountRecovered: 5000 },
    });
    (prisma.recoveryAuditLog.count as jest.Mock).mockResolvedValue(0);

    const metrics = await getRecoveryMetrics();

    expect(metrics.revenue.atRisk).toBe(30000);
    expect(metrics.revenue.recovered).toBe(5000);
    // (5000 / 30000) * 100 = 16.6666... -> 16.67
    expect(metrics.revenue.recoveryRate).toBe(16.67);
  });

  // ── Test 3 — Case status counts ────────────────────────────────────────────
  it('Test 3 — Case status counts across all recoverability statuses', async () => {
    (prisma.recoveryCase.groupBy as jest.Mock).mockResolvedValue([
      { recoverabilityStatus: 'PENDING_ASSESSMENT', _count: { _all: 2 } },
      { recoverabilityStatus: 'RECOVERABLE', _count: { _all: 5 } },
      { recoverabilityStatus: 'RECOVERED', _count: { _all: 3 } },
      { recoverabilityStatus: 'RECOVERY_FAILED', _count: { _all: 1 } },
      { recoverabilityStatus: 'NOT_RECOVERABLE', _count: { _all: 4 } },
    ]);
    (prisma.recoveryCase.aggregate as jest.Mock).mockResolvedValue({
      _sum: { revenueAtRisk: 100000, amountRecovered: 30000 },
    });
    (prisma.recoveryAuditLog.count as jest.Mock).mockResolvedValue(0);

    const metrics = await getRecoveryMetrics();

    expect(metrics.cases).toEqual({
      total: 15,
      pending: 2,
      recoverable: 5,
      recovered: 3,
      recoveryFailed: 1,
      notRecoverable: 4,
    });
  });

  // ── Test 4 — Case recovery rate ────────────────────────────────────────────
  it('Test 4 — Case recovery rate (RECOVERED / eligibleCases)', async () => {
    (prisma.recoveryCase.groupBy as jest.Mock).mockResolvedValue([
      { recoverabilityStatus: 'RECOVERABLE', _count: { _all: 3 } },
      { recoverabilityStatus: 'RECOVERED', _count: { _all: 2 } },
      { recoverabilityStatus: 'RECOVERY_FAILED', _count: { _all: 1 } },
    ]);
    (prisma.recoveryCase.aggregate as jest.Mock).mockResolvedValue({
      _sum: { revenueAtRisk: 60000, amountRecovered: 20000 },
    });
    (prisma.recoveryAuditLog.count as jest.Mock).mockResolvedValue(0);

    const metrics = await getRecoveryMetrics();

    // eligibleCases = RECOVERABLE (3) + RECOVERED (2) + RECOVERY_FAILED (1) = 6
    // caseRecoveryRate = (2 / 6) * 100 = 33.3333... -> 33.33
    expect(metrics.recovery.eligibleCases).toBe(6);
    expect(metrics.recovery.caseRecoveryRate).toBe(33.33);
  });

  // ── Test 5 — Zero eligible cases ──────────────────────────────────────────
  it('Test 5 — Zero eligible cases handled safely without division by zero', async () => {
    (prisma.recoveryCase.groupBy as jest.Mock).mockResolvedValue([
      { recoverabilityStatus: 'PENDING_ASSESSMENT', _count: { _all: 5 } },
      { recoverabilityStatus: 'NOT_RECOVERABLE', _count: { _all: 5 } },
    ]);
    (prisma.recoveryCase.aggregate as jest.Mock).mockResolvedValue({
      _sum: { revenueAtRisk: 50000, amountRecovered: 0 },
    });
    (prisma.recoveryAuditLog.count as jest.Mock).mockResolvedValue(0);

    const metrics = await getRecoveryMetrics();

    expect(metrics.recovery.eligibleCases).toBe(0);
    expect(metrics.recovery.caseRecoveryRate).toBe(0);
  });

  // ── Test 6 — Audit action counts ──────────────────────────────────────────
  it('Test 6 — Audit action counts query existing repository audit events', async () => {
    (prisma.recoveryCase.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.recoveryCase.aggregate as jest.Mock).mockResolvedValue({
      _sum: { revenueAtRisk: 0, amountRecovered: 0 },
    });

    (prisma.recoveryAuditLog.count as jest.Mock)
      .mockResolvedValueOnce(12) // PAYMENT_LINK_CREATED
      .mockResolvedValueOnce(7)  // RECOVERY_REMINDER_SENT
      .mockResolvedValueOnce(3)  // status = FAILED
      .mockResolvedValueOnce(4); // status = SKIPPED

    const metrics = await getRecoveryMetrics();

    expect(metrics.actions).toEqual({
      paymentLinksCreated: 12,
      remindersSent: 7,
      failed: 3,
      skipped: 4,
    });
    expect(prisma.recoveryAuditLog.count).toHaveBeenCalledWith({ where: { action: 'PAYMENT_LINK_CREATED' } });
    expect(prisma.recoveryAuditLog.count).toHaveBeenCalledWith({ where: { action: 'RECOVERY_REMINDER_SENT' } });
    expect(prisma.recoveryAuditLog.count).toHaveBeenCalledWith({ where: { status: 'FAILED' } });
    expect(prisma.recoveryAuditLog.count).toHaveBeenCalledWith({ where: { status: 'SKIPPED' } });
  });

  // ── Test 7 — Duplicate audit events vs case counts ───────────────────────
  it('Test 7 — Duplicate audit events do not inflate case counts', async () => {
    // 1 case total
    (prisma.recoveryCase.groupBy as jest.Mock).mockResolvedValue([
      { recoverabilityStatus: 'RECOVERABLE', _count: { _all: 1 } },
    ]);
    (prisma.recoveryCase.aggregate as jest.Mock).mockResolvedValue({
      _sum: { revenueAtRisk: 10000, amountRecovered: 0 },
    });

    // Multiple audit actions logged for that single case
    (prisma.recoveryAuditLog.count as jest.Mock)
      .mockResolvedValueOnce(1) // PAYMENT_LINK_CREATED
      .mockResolvedValueOnce(2) // RECOVERY_REMINDER_SENT (2 reminders sent for 1 case)
      .mockResolvedValueOnce(0) // FAILED
      .mockResolvedValueOnce(0); // SKIPPED

    const metrics = await getRecoveryMetrics();

    expect(metrics.cases.total).toBe(1);
    expect(metrics.actions.remindersSent).toBe(2);
  });
});

describe('GET /recovery-cases/metrics — HTTP Route', () => {
  const app = createApp();
  const API_KEY = process.env.INTERNAL_API_KEY || 'test_internal_key';

  beforeAll(() => {
    process.env.INTERNAL_API_KEY = API_KEY;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 Unauthorized if x-internal-key header is missing', async () => {
    const res = await request(app).get('/recovery-cases/metrics');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 200 OK and metrics response structure when authenticated', async () => {
    (prisma.recoveryCase.groupBy as jest.Mock).mockResolvedValue([
      { recoverabilityStatus: 'RECOVERED', _count: { _all: 2 } },
    ]);
    (prisma.recoveryCase.aggregate as jest.Mock).mockResolvedValue({
      _sum: { revenueAtRisk: 100000, amountRecovered: 100000 },
    });
    (prisma.recoveryAuditLog.count as jest.Mock).mockResolvedValue(2);

    const res = await request(app)
      .get('/recovery-cases/metrics')
      .set('x-internal-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('cases');
    expect(res.body).toHaveProperty('revenue');
    expect(res.body).toHaveProperty('recovery');
    expect(res.body).toHaveProperty('actions');
  });
});
