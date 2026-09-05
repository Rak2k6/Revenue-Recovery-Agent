/**
 * batchRunner.test.ts
 *
 * Phase 3B: Tests for runRecoveryBatch().
 *
 * Strategy:
 *  - Mock prisma.recoveryCase.findMany (eligibility query).
 *  - Mock runRecoveryPipeline at the module boundary.
 *  - Never mock the batch runner itself.
 *  - Verify counts, revenue aggregation, error isolation, and limit enforcement.
 */

import { runRecoveryBatch, DEFAULT_BATCH_LIMIT } from '../src/jobs/recoveryBatchRunner';
import * as pipelineModule from '../src/recovery/recoveryPipeline';
import { prisma } from '../src/db/prismaClient';
import { PipelineResult } from '../src/recovery/recoveryPipeline';
import { ExecutionResult } from '../src/recovery/actionExecutor';
import { LLMRecoveryDecision } from '../src/recovery/schemas/llmRecoveryDecisionSchema';
import { PolicyDecision } from '../src/recovery/schemas/policyDecisionSchema';
import { RecoveryContext } from '../src/recovery/schemas/recoveryContextSchema';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

jest.mock('../src/db/prismaClient', () => ({
  prisma: {
    recoveryCase: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../src/recovery/recoveryPipeline', () => ({
  runRecoveryPipeline: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/** Minimal stub for the select projection returned by fetchEligibleCases */
function makeStub(id: string, revenueAtRisk: number) {
  return { id, revenueAtRisk };
}

function makeContext(): RecoveryContext {
  return {
    schemaVersion: 1,
    payment: {
      razorpayPaymentId: 'rzp_pay_test',
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
      tenureDays: 5,
      totalSuccessfulPayments: 1,
      totalFailedPayments: 0,
      lifetimeValue: 50000,
      averageOrderValue: 50000,
      hasEmail: true,
      hasContact: false,
    },
    recovery: {
      recoveryAttemptCount: 0,
      maxRecoveryAttempts: 3,
      attemptsRemaining: 3,
      previousActionsThisCase: [],
      existingRecoveryLinkUrl: null,
      caseAgeMinutes: 5,
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

function makeLLMDecision(): LLMRecoveryDecision {
  return {
    schemaVersion: 1,
    failure_class: 'CUSTOMER_ABANDONMENT',
    recoverability: 'high',
    confidence: 0.80,
    recovery_probability: 0.65,
    recommended_action: 'CREATE_PAYMENT_LINK',
    reason_codes: ['RECOVERABLE_FAILURE'],
    reasoning: 'Recoverable abandonment.',
  };
}

function makeApprovedPolicy(): PolicyDecision {
  return {
    schemaVersion: 1,
    approved: true,
    action: 'CREATE_PAYMENT_LINK',
    reason: 'Recovery action is permitted.',
    stopCondition: null,
  };
}

function makeRejectedPolicy(): PolicyDecision {
  return {
    schemaVersion: 1,
    approved: false,
    action: 'STOP',
    reason: 'Risk rejection.',
    stopCondition: 'RISK_REJECTED',
  };
}

function makeExecutionResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    success: true,
    recoveryCaseId: 'case_x',
    action: 'CREATE_PAYMENT_LINK',
    status: 'COMPLETED',
    revenueAtRisk: 50000,
    message: 'Recovery payment link created.',
    ...overrides,
  };
}

function makeSkippedResult(caseId: string): ExecutionResult {
  return {
    success: false,
    recoveryCaseId: caseId,
    action: 'STOP',
    status: 'SKIPPED',
    message: 'Policy rejected — no side effects.',
  };
}

function makePipelineResult(caseId: string, executionResult: ExecutionResult): PipelineResult {
  return {
    result: executionResult,
    llmDecision: makeLLMDecision(),
    policyDecision: executionResult.status === 'SKIPPED' ? makeRejectedPolicy() : makeApprovedPolicy(),
    context: makeContext(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 3B: runRecoveryBatch()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Test 1: Processes all eligible cases ────────────────────────────────

  it('1. Processes eligible PENDING_ASSESSMENT cases and returns correct counts', async () => {
    const stubs = [
      makeStub('case_A', 10000),
      makeStub('case_B', 25000),
      makeStub('case_C', 50000),
    ];

    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue(stubs);

    (pipelineModule.runRecoveryPipeline as jest.Mock)
      .mockResolvedValueOnce(makePipelineResult('case_A', makeExecutionResult({ recoveryCaseId: 'case_A', revenueAtRisk: 10000 })))
      .mockResolvedValueOnce(makePipelineResult('case_B', makeExecutionResult({ recoveryCaseId: 'case_B', revenueAtRisk: 25000 })))
      .mockResolvedValueOnce(makePipelineResult('case_C', makeExecutionResult({ recoveryCaseId: 'case_C', revenueAtRisk: 50000 })));

    const summary = await runRecoveryBatch();

    // All three cases sent through pipeline
    expect(pipelineModule.runRecoveryPipeline).toHaveBeenCalledTimes(3);
    expect(pipelineModule.runRecoveryPipeline).toHaveBeenNthCalledWith(1, 'case_A');
    expect(pipelineModule.runRecoveryPipeline).toHaveBeenNthCalledWith(2, 'case_B');
    expect(pipelineModule.runRecoveryPipeline).toHaveBeenNthCalledWith(3, 'case_C');

    expect(summary.processed).toBe(3);
    expect(summary.succeeded).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.skipped).toBe(0);
  });

  // ── Test 2: Respects the configured limit ───────────────────────────────

  it('2. Respects limit — only processes up to limit cases', async () => {
    // DB returns only 3 even though 10 exist — Prisma TAKE clause handles this,
    // so we simulate that the DB already filtered to limit=3.
    const stubs = [
      makeStub('case_1', 5000),
      makeStub('case_2', 5000),
      makeStub('case_3', 5000),
    ];

    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue(stubs);

    (pipelineModule.runRecoveryPipeline as jest.Mock).mockResolvedValue(
      makePipelineResult('case_x', makeExecutionResult())
    );

    const summary = await runRecoveryBatch({ limit: 3 });

    // Verify the take value passed to prisma is the limit
    expect(prisma.recoveryCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 })
    );

    expect(summary.processed).toBe(3);
    expect(pipelineModule.runRecoveryPipeline).toHaveBeenCalledTimes(3);
  });

  // ── Test 3: One case failure does not abort the batch ───────────────────

  it('3. Error isolation — a failing case does not abort subsequent cases', async () => {
    const stubs = [
      makeStub('case_A', 10000),
      makeStub('case_B', 20000),
      makeStub('case_C', 30000),
    ];

    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue(stubs);

    (pipelineModule.runRecoveryPipeline as jest.Mock)
      // case_A: success
      .mockResolvedValueOnce(makePipelineResult('case_A', makeExecutionResult({ recoveryCaseId: 'case_A' })))
      // case_B: unexpected throw
      .mockRejectedValueOnce(new Error('DB connection lost'))
      // case_C: success
      .mockResolvedValueOnce(makePipelineResult('case_C', makeExecutionResult({ recoveryCaseId: 'case_C' })));

    const summary = await runRecoveryBatch();

    // All three cases were attempted
    expect(pipelineModule.runRecoveryPipeline).toHaveBeenCalledTimes(3);

    expect(summary.processed).toBe(3);
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(0);

    // The failed outcome carries the error message
    const failedOutcome = summary.outcomes.find(o => o.recoveryCaseId === 'case_B');
    expect(failedOutcome?.status).toBe('failed');
    expect(failedOutcome?.error).toContain('DB connection lost');
  });

  // ── Test 4: No eligible cases ────────────────────────────────────────────

  it('4. No eligible cases — returns zero counts without calling pipeline', async () => {
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([]);

    const summary = await runRecoveryBatch();

    expect(pipelineModule.runRecoveryPipeline).not.toHaveBeenCalled();
    expect(summary.processed).toBe(0);
    expect(summary.succeeded).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.skipped).toBe(0);
    expect(summary.revenueAtRisk).toBe(0);
    expect(summary.outcomes).toHaveLength(0);
  });

  // ── Test 5: Concurrent batch safety ─────────────────────────────────────

  it('5. Concurrent batches — executor atomic-claim remains the ultimate protection', async () => {
    // Two concurrent batch runs both select the same case.
    // Batch runner itself does no locking; the executor's updateMany claim
    // handles this. We verify the batch runner still calls the pipeline for
    // each selected case and the per-case result is determined by whatever
    // the executor returns (here: second call is "already claimed" = skipped).
    const stubs = [makeStub('case_shared', 50000)];

    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue(stubs);

    const completedResult = makeExecutionResult({ recoveryCaseId: 'case_shared', status: 'COMPLETED' });
    const skippedResult = makeSkippedResult('case_shared');

    // First batch invocation → executor succeeds
    (pipelineModule.runRecoveryPipeline as jest.Mock)
      .mockResolvedValueOnce(makePipelineResult('case_shared', completedResult))
      // Second batch invocation → executor returns SKIPPED (another process claimed it)
      .mockResolvedValueOnce(makePipelineResult('case_shared', skippedResult));

    const [summaryA, summaryB] = await Promise.all([
      runRecoveryBatch({ limit: 1 }),
      runRecoveryBatch({ limit: 1 }),
    ]);

    // Both invocations called the pipeline
    expect(pipelineModule.runRecoveryPipeline).toHaveBeenCalledTimes(2);

    // First batch: COMPLETED → succeeded
    expect(summaryA.succeeded).toBe(1);
    expect(summaryA.failed).toBe(0);

    // Second batch: SKIPPED (executor atomic-claim rejected it)
    expect(summaryB.skipped).toBe(1);
    expect(summaryB.failed).toBe(0);
    // No external side effects (Razorpay) for the skipped case — that
    // guarantee is enforced by the executor and already tested in
    // recoveryExecution.test.ts.
  });

  // ── Test 6: Revenue-at-risk aggregation ─────────────────────────────────

  it('6. Revenue-at-risk aggregated correctly across all eligible cases in paise', async () => {
    const stubs = [
      makeStub('case_X', 10000),   // 100 INR
      makeStub('case_Y', 25000),   // 250 INR
      makeStub('case_Z', 50000),   // 500 INR
    ];

    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue(stubs);

    (pipelineModule.runRecoveryPipeline as jest.Mock)
      .mockResolvedValueOnce(makePipelineResult('case_X', makeExecutionResult({ recoveryCaseId: 'case_X', revenueAtRisk: 10000 })))
      .mockResolvedValueOnce(makePipelineResult('case_Y', makeExecutionResult({ recoveryCaseId: 'case_Y', revenueAtRisk: 25000 })))
      .mockResolvedValueOnce(makePipelineResult('case_Z', makeExecutionResult({ recoveryCaseId: 'case_Z', revenueAtRisk: 50000 })));

    const summary = await runRecoveryBatch();

    // 10000 + 25000 + 50000 = 85000 paise
    expect(summary.revenueAtRisk).toBe(85000);

    // Confirm this is NOT reported as recovered revenue — the summary has no
    // recoveredAmount field at this milestone
    expect((summary as any).recoveredAmount).toBeUndefined();
  });

  // ── Test 7: Policy-rejected cases counted as skipped, not failed ─────────

  it('7. Policy-rejected cases are counted as skipped (not failed)', async () => {
    const stubs = [makeStub('case_risk', 30000)];

    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue(stubs);

    const skippedResult = makeSkippedResult('case_risk');
    (pipelineModule.runRecoveryPipeline as jest.Mock).mockResolvedValue(
      makePipelineResult('case_risk', skippedResult)
    );

    const summary = await runRecoveryBatch();

    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(summary.failed).toBe(0);

    const outcome = summary.outcomes[0];
    expect(outcome.status).toBe('skipped');
    expect(outcome.action).toBe('STOP');
  });

  // ── Test 8: Default limit ────────────────────────────────────────────────

  it('8. Uses DEFAULT_BATCH_LIMIT when no limit is specified', async () => {
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([]);

    await runRecoveryBatch();

    expect(prisma.recoveryCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: DEFAULT_BATCH_LIMIT })
    );
  });
});
