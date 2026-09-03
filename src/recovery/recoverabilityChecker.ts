import { FailureCategory } from '../models/internalTypes';

/**
 * Non-recoverable failure categories — payments that should NOT get
 * a RecoveryCase because automated retry is unsafe or inappropriate.
 *
 * Milestone 1: RISK_REJECTION is the only hard non-recoverable category.
 * Milestone 2+: extend this list based on real recovery outcome data.
 */
const NON_RECOVERABLE: Set<FailureCategory> = new Set([
  'RISK_REJECTION',
]);

/**
 * Returns true if this failure category is worth attempting recovery on.
 * A failed payment only becomes a RecoveryCase when this returns true.
 */
export function isRecoverable(category: FailureCategory): boolean {
  return !NON_RECOVERABLE.has(category);
}
