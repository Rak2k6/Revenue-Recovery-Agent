import { RecoveryContext } from './schemas/recoveryContextSchema';
import { LLMRecoveryDecision } from './schemas/llmRecoveryDecisionSchema';
import {
  PolicyDecision,
  PolicyDecisionSchema,
  StopCondition,
} from './schemas/policyDecisionSchema';

// ---------------------------------------------------------------------------
// MVP Policy Constants
// ---------------------------------------------------------------------------

/**
 * Minimum LLM confidence required to approve an automated recovery action.
 *
 * MVP threshold: 0.60
 * Source: Phase 2E policy definition — no pre-existing threshold was found in
 * the repository. This constant is the single authoritative definition.
 */
export const LLM_MIN_CONFIDENCE = 0.60;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function stop(reason: string, stopCondition: StopCondition): PolicyDecision {
  return PolicyDecisionSchema.parse({
    schemaVersion: 1,
    approved: false,
    action: 'STOP',
    reason,
    stopCondition,
  });
}

function noAction(reason: string): PolicyDecision {
  return PolicyDecisionSchema.parse({
    schemaVersion: 1,
    approved: false,
    action: 'NO_ACTION',
    reason,
    stopCondition: null,
  });
}

function approve(action: 'CREATE_PAYMENT_LINK' | 'SEND_RECOVERY_REMINDER', reason: string): PolicyDecision {
  return PolicyDecisionSchema.parse({
    schemaVersion: 1,
    approved: true,
    action,
    reason,
    stopCondition: null,
  });
}

function requiresContactChannel(action: string): boolean {
  return action === 'CREATE_PAYMENT_LINK' || action === 'SEND_RECOVERY_REMINDER';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deterministic Policy Engine — Phase 2E.
 *
 * Evaluates a validated RecoveryContext and an LLMRecoveryDecision against all
 * mandatory policy rules and returns a PolicyDecision.
 *
 * Properties:
 *  - Deterministic (no randomness, no ML inference)
 *  - Synchronous
 *  - Side-effect free (no DB, no network, no Razorpay, no Groq)
 *  - Independently testable
 *
 * Rule precedence (highest → lowest):
 *  1. RISK_REJECTION
 *  2. Recovery window expired
 *  3. Attempts exhausted
 *  4. Contact limit / contact channel availability
 *  5. LLM recommends STOP
 *  6. LLM confidence below threshold
 *  7. LLM recommends NO_ACTION
 *  8. CREATE_PAYMENT_LINK conditions (incl. duplicate-link guard)
 *  9. SEND_RECOVERY_REMINDER conditions
 * 10. Default STOP
 */
export function evaluateRecoveryPolicy(
  context: RecoveryContext,
  decision: LLMRecoveryDecision
): PolicyDecision {

  // ─── Rule 1: Risk Rejection ───────────────────────────────────────────────
  // Absolute override. Risk/fraud decisions must never be circumvented.
  if (context.failure.category === 'RISK_REJECTION') {
    return stop(
      'Risk rejection cannot be bypassed by automated recovery.',
      'RISK_REJECTED'
    );
  }

  // ─── Rule 2: Recovery Window Expired ─────────────────────────────────────
  if (context.policy.recoveryWindowRemainingMinutes <= 0) {
    return stop(
      'The recovery window has expired; no automated action is permitted.',
      'RECOVERY_WINDOW_EXPIRED'
    );
  }

  // ─── Rule 3: Attempts Exhausted ───────────────────────────────────────────
  if (context.recovery.attemptsRemaining <= 0) {
    return stop(
      'The maximum number of recovery attempts has been reached.',
      'POLICY_LIMIT_REACHED'
    );
  }

  // ─── Rule 4: Contact Limit / Contact Channel ─────────────────────────────
  // If the recommended action requires a customer contact channel, both the
  // policy contact limit and at least one usable channel must be satisfied.
  if (requiresContactChannel(decision.recommended_action)) {
    if (!context.policy.withinContactLimit) {
      return stop(
        'Contact limit has been reached; automated customer contact is not permitted.',
        'POLICY_LIMIT_REACHED'
      );
    }
    if (!context.customer.hasEmail && !context.customer.hasContact) {
      return stop(
        'No customer contact channel is available for automated recovery.',
        'POLICY_LIMIT_REACHED'
      );
    }
  }

  // ─── Rule 5: LLM recommends STOP ─────────────────────────────────────────
  if (decision.recommended_action === 'STOP') {
    const hasLowConfidence = decision.reason_codes.includes('LOW_CONFIDENCE');
    return stop(
      'The AI recovery agent determined that automated recovery is not appropriate.',
      hasLowConfidence ? 'LOW_CONFIDENCE' : 'NOT_RECOVERABLE'
    );
  }

  // ─── Rule 6: LLM confidence below threshold ───────────────────────────────
  if (decision.confidence < LLM_MIN_CONFIDENCE) {
    return stop(
      `LLM confidence (${decision.confidence.toFixed(2)}) is below the minimum required threshold (${LLM_MIN_CONFIDENCE}).`,
      'LOW_CONFIDENCE'
    );
  }

  // ─── Rule 7: LLM recommends NO_ACTION ────────────────────────────────────
  // Not a policy violation — the system intentionally chose not to intervene.
  if (decision.recommended_action === 'NO_ACTION') {
    return noAction(
      'The AI recovery agent determined that no automated intervention is required at this time.'
    );
  }

  // ─── Rule 8: CREATE_PAYMENT_LINK ─────────────────────────────────────────
  if (decision.recommended_action === 'CREATE_PAYMENT_LINK') {
    // Idempotency safeguard: do not create a duplicate recovery link.
    if (context.recovery.existingRecoveryLinkUrl != null) {
      return noAction(
        'An existing recovery link is already available; a duplicate link should not be created.'
      );
    }
    return approve(
      'CREATE_PAYMENT_LINK',
      'Recovery action is permitted under the current policy constraints.'
    );
  }

  // ─── Rule 9: SEND_RECOVERY_REMINDER ──────────────────────────────────────
  if (decision.recommended_action === 'SEND_RECOVERY_REMINDER') {
    // A reminder is only meaningful when a prior recovery opportunity exists.
    if (context.recovery.existingRecoveryLinkUrl == null) {
      return stop(
        'A recovery reminder cannot be sent because there is no existing recovery opportunity to follow up.',
        'NOT_RECOVERABLE'
      );
    }
    return approve(
      'SEND_RECOVERY_REMINDER',
      'A recovery reminder is permitted; an existing recovery opportunity is available.'
    );
  }

  // ─── Rule 10: Default STOP ────────────────────────────────────────────────
  // Should not normally be reached given the LLMActionEnum is a closed set,
  // but acts as a final defensive fallback.
  return stop(
    'The recommended action could not be authorized under the current policy constraints.',
    'NOT_RECOVERABLE'
  );
}
