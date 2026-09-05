import { prisma } from '../db/prismaClient';
import { runRecoveryPipeline } from '../recovery/recoveryPipeline';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default maximum number of cases processed per batch invocation.
 * Kept small to bound wall-clock time and LLM API usage per run.
 */
export const DEFAULT_BATCH_LIMIT = 25;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BatchRunOptions {
  /**
   * Maximum number of eligible cases to process in this invocation.
   * Defaults to DEFAULT_BATCH_LIMIT.
   */
  limit?: number;
}

/**
 * Per-case outcome recorded during the batch run.
 * Mirrors the fields callers need without exposing raw PipelineResult.
 */
export interface BatchCaseOutcome {
  recoveryCaseId: string;
  status: 'succeeded' | 'failed' | 'skipped';
  action?: string;
  revenueAtRisk?: number;
  error?: string;
}

/**
 * Aggregate summary returned by runRecoveryBatch().
 */
export interface BatchRunSummary {
  /** Total number of eligible cases selected for this run. */
  processed: number;
  /** Cases where the pipeline completed without throwing. */
  succeeded: number;
  /** Cases where the pipeline threw an unexpected error. */
  failed: number;
  /**
   * Cases the pipeline completed but the executor skipped (policy rejection,
   * NO_ACTION, STOP).  These are "processed" but not "succeeded" in the
   * revenue-recovery sense.
   */
  skipped: number;
  /**
   * Sum of revenueAtRisk for every case selected in this run, in paise.
   * This is NOT recovered revenue — it represents the potential revenue
   * eligible for automated recovery.
   */
  revenueAtRisk: number;
  /** Per-case outcomes for caller inspection or logging. */
  outcomes: BatchCaseOutcome[];
}

// ---------------------------------------------------------------------------
// Eligibility query
// ---------------------------------------------------------------------------

/**
 * Returns up to `limit` recovery cases that are candidates for automated
 * batch processing.
 *
 * Eligibility criteria:
 *  1. recoverabilityStatus = PENDING_ASSESSMENT
 *     — Cases that have not yet been through the LLM→Policy→Executor pipeline.
 *  2. actionStatus NOT IN (IN_PROGRESS, COMPLETED)
 *     — Skip cases the executor has already claimed or finished. This avoids
 *       a redundant DB read in the pipeline and surfaces the executor's own
 *       atomic-claim guard only when genuinely needed.
 *
 * The batch runner intentionally does NOT include RECOVERABLE/RECOVERY_FAILED
 * cases in the initial query. Those may warrant retry logic in a later
 * milestone, but automating retries without explicit business sign-off is
 * outside Phase 3B scope.
 *
 * Ordered by createdAt ASC (oldest first) so high-value aged cases are not
 * indefinitely starved by new ones.
 */
async function fetchEligibleCases(limit: number) {
  return prisma.recoveryCase.findMany({
    where: {
      recoverabilityStatus: 'PENDING_ASSESSMENT',
      actionStatus: { notIn: ['IN_PROGRESS', 'COMPLETED'] },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    // Only select the columns the runner needs to build its summary.
    // The pipeline's contextBuilder re-fetches the full record with all
    // relations — this projection avoids a redundant heavy JOIN here.
    select: {
      id: true,
      revenueAtRisk: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Phase 3B — Batch Recovery Runner.
 *
 * Processes up to `options.limit` eligible recovery cases by calling the
 * existing reusable pipeline for each one:
 *
 *   runRecoveryPipeline(case.id)
 *       → Context → LLM → Policy → Executor
 *
 * Properties:
 *  - Sequential processing (safe, predictable, LLM-rate-limit-friendly).
 *  - Error isolation: one case failure does NOT abort subsequent cases.
 *  - Concurrency safety: relies on the executor's existing atomic DB claim
 *    (updateMany where actionStatus NOT IN [IN_PROGRESS, COMPLETED]).
 *  - Never calls Razorpay directly.
 *  - Does not modify the Prisma schema.
 *  - Does not duplicate pipeline logic.
 *
 * @param options  Optional configuration (limit).
 * @returns        Aggregate BatchRunSummary.
 */
export async function runRecoveryBatch(options: BatchRunOptions = {}): Promise<BatchRunSummary> {
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT;

  // Validate limit to prevent runaway queries
  const safeLimit = Math.max(1, Math.min(limit, 100));

  const eligibleCases = await fetchEligibleCases(safeLimit);

  const summary: BatchRunSummary = {
    processed: eligibleCases.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    revenueAtRisk: 0,
    outcomes: [],
  };

  // Accumulate total revenue at risk for all selected cases up-front.
  // This represents the potential batch value regardless of pipeline outcome.
  for (const c of eligibleCases) {
    summary.revenueAtRisk += c.revenueAtRisk;
  }

  // Process cases sequentially to:
  //  a) stay within Groq LLM rate limits,
  //  b) keep the audit trail predictable and ordered,
  //  c) avoid simultaneous Razorpay calls for independent cases.
  for (const caseStub of eligibleCases) {
    try {
      const pipelineResult = await runRecoveryPipeline(caseStub.id);

      const { result } = pipelineResult;

      // Classify based on the executor's status field.
      // 'SKIPPED' covers policy rejections, NO_ACTION, and STOP — all
      // handled correctly by the existing executor without side effects.
      if (result.status === 'SKIPPED') {
        summary.skipped += 1;
        summary.outcomes.push({
          recoveryCaseId: caseStub.id,
          status: 'skipped',
          action: result.action,
          revenueAtRisk: caseStub.revenueAtRisk,
        });
      } else {
        // COMPLETED or FAILED — both are "pipeline ran without throwing"
        summary.succeeded += 1;
        summary.outcomes.push({
          recoveryCaseId: caseStub.id,
          status: 'succeeded',
          action: result.action,
          revenueAtRisk: caseStub.revenueAtRisk,
        });
      }
    } catch (err: any) {
      // Pipeline threw — likely a DB or network error outside the executor's
      // own error handling. Record and continue to the next case.
      summary.failed += 1;
      summary.outcomes.push({
        recoveryCaseId: caseStub.id,
        status: 'failed',
        revenueAtRisk: caseStub.revenueAtRisk,
        error: err?.message ?? 'Unknown error during pipeline execution.',
      });
    }
  }

  return summary;
}
