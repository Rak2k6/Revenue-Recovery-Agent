import { z } from 'zod';

// Reuse the LLMActionEnum shape but define the policy-level action enum independently
// so the Policy Engine contract is self-contained.
export const PolicyActionEnum = z.enum([
  'NO_ACTION',
  'CREATE_PAYMENT_LINK',
  'SEND_RECOVERY_REMINDER',
  'STOP',
]);

/**
 * Canonical set of stop conditions for the deterministic Policy Engine.
 * These represent the reason an automated recovery action was not approved.
 *
 * LOW_CONFIDENCE              – LLM confidence below the minimum threshold
 * RISK_REJECTED               – Failure category is RISK_REJECTION; never recoverable
 * POLICY_LIMIT_REACHED        – Recovery attempt limit exhausted or contact limit exceeded
 * RECOVERY_WINDOW_EXPIRED     – 24-hour (or configured) recovery window has closed
 * NOT_RECOVERABLE             – LLM recommended STOP; failure is not recoverable
 * LLM_FAILURE                 – LLM returned an unusable/fallback decision
 * SCHEMA_VALIDATION_FAILED    – Internal schema validation failure
 */
export const StopConditionEnum = z.enum([
  'LOW_CONFIDENCE',
  'RISK_REJECTED',
  'POLICY_LIMIT_REACHED',
  'RECOVERY_WINDOW_EXPIRED',
  'NOT_RECOVERABLE',
  'LLM_FAILURE',
  'SCHEMA_VALIDATION_FAILED',
]);

export const PolicyDecisionSchema = z.object({
  schemaVersion: z.literal(1),
  approved: z.boolean(),
  action: PolicyActionEnum,
  reason: z.string().min(1).max(500),
  stopCondition: StopConditionEnum.nullable(),
});

export type PolicyAction = z.infer<typeof PolicyActionEnum>;
export type StopCondition = z.infer<typeof StopConditionEnum>;
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
