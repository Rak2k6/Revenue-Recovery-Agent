import { NormalizedPaymentEvent } from '../models/internalTypes';

/**
 * Calculates the revenue at risk for a failed payment.
 *
 * Milestone 1 definition:
 *   revenue_at_risk = amount - amount_already_refunded
 *
 * Named "revenueRisk" (not "riskScore") intentionally:
 *   - This is a deterministic monetary calculation, NOT a probability score.
 *   - Milestone 2 will introduce recoveryScorer.ts for recovery_probability (0–1).
 *
 * Returns 0 for non-failed or already-captured payments.
 */
export function calculateRevenueAtRisk(event: NormalizedPaymentEvent): number {
  if (event.status !== 'FAILED') return 0;
  if (event.captured) return 0;  // Guard: captured payments are never at-risk
  return Math.max(0, event.amount - event.amountRefunded);
}
