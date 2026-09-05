import { buildRecoveryContext } from './contextBuilder';
import { decideWithLLM } from './llmAgent';
import { evaluateRecoveryPolicy } from './policyEngine';
import { executeRecoveryAction, ExecutionResult } from './actionExecutor';
import { LLMRecoveryDecision } from './schemas/llmRecoveryDecisionSchema';
import { PolicyDecision } from './schemas/policyDecisionSchema';
import { RecoveryContext } from './schemas/recoveryContextSchema';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * The structured result returned by runRecoveryPipeline().
 *
 * Contains the full execution result plus the intermediate LLM and policy
 * decisions so that callers (HTTP route, batch runner) can surface them
 * without needing to re-run any pipeline stage.
 */
export interface PipelineResult {
  /** Final outcome from the Action Executor */
  result: ExecutionResult;
  /** Intermediate LLM recommendation produced in this run */
  llmDecision: LLMRecoveryDecision;
  /** Deterministic policy decision produced from LLM output + context */
  policyDecision: PolicyDecision;
  /** The RecoveryContext assembled for this run */
  context: RecoveryContext;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Phase 3A — Reusable Recovery Pipeline.
 *
 * Orchestrates the full recovery execution pipeline for a single RecoveryCase:
 *
 *   buildRecoveryContext(recoveryCaseId)
 *       ↓
 *   decideWithLLM(context)
 *       ↓
 *   evaluateRecoveryPolicy(context, llmDecision)
 *       ↓
 *   executeRecoveryAction(recoveryCaseId, policyDecision, context)
 *
 * This function contains NO Express-specific code. It does not access
 * Request, Response, or route parameters. It is a domain/application service
 * that can be called from the HTTP route, a batch runner, or any other entry
 * point.
 *
 * Errors thrown by any stage propagate to the caller. The HTTP route wraps
 * this function in try/catch; the batch runner will do the same.
 *
 * @param recoveryCaseId  ID of the RecoveryCase to process.
 * @returns               PipelineResult containing the execution outcome and
 *                        all intermediate decisions.
 */
export async function runRecoveryPipeline(recoveryCaseId: string): Promise<PipelineResult> {
  // Phase 2C: Build validated RecoveryContext
  const context = await buildRecoveryContext(recoveryCaseId);

  // Phase 2D: Obtain LLM recommendation (always returns a valid decision — may be STOP fallback)
  const llmDecision = await decideWithLLM(context);

  // Phase 2E: Deterministic Policy Engine — authorises or stops the action
  const policyDecision = evaluateRecoveryPolicy(context, llmDecision);

  // Phase 2F: Execute only if approved
  const result = await executeRecoveryAction(recoveryCaseId, policyDecision, context);

  return { result, llmDecision, policyDecision, context };
}
