import { Payment, RecoveryCase } from '@prisma/client';
import { RecoveryDecision } from './recoveryTypes';

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
}

export function validateRecoveryDecision(
  decision: RecoveryDecision,
  recoveryCase: RecoveryCase,
  payment: Payment
): GuardrailResult {
  // 1. Unknown failures require review rather than blind automation.
  if (decision.failureCategory === 'UNKNOWN' || decision.recoverability === 'REVIEW_REQUIRED') {
    return { allowed: false, reason: 'Policy blocked: Unknown failures require manual review.' };
  }

  // 2. Never retry risk/fraud rejection.
  if (decision.failureCategory === 'RISK_REJECTION' || decision.recoverability === 'NOT_RECOVERABLE') {
    return { allowed: false, reason: 'Policy blocked: Cannot recover a risk rejection or not recoverable payment.' };
  }

  // 3. Never retry more than maxAttempts.
  if (recoveryCase.recoveryAttemptCount >= decision.maxAttempts) {
    return { allowed: false, reason: `Policy blocked: Max recovery attempts (${decision.maxAttempts}) reached.` };
  }

  // 3. Never create a recovery action for captured/refunded payments.
  if (payment.status === 'CAPTURED' || payment.status === 'REFUNDED' || payment.captured) {
    return { allowed: false, reason: 'Policy blocked: Payment is already captured or refunded.' };
  }

  // 4. Never recover more than the original revenue-at-risk.
  // (In Milestone 2, we just ensure revenueAtRisk > 0, as we don't process amounts yet)
  if (recoveryCase.revenueAtRisk <= 0) {
    return { allowed: false, reason: 'Policy blocked: No revenue at risk.' };
  }

  // 5. Never execute multiple recovery actions simultaneously.
  if (recoveryCase.actionStatus === 'PENDING' || recoveryCase.actionStatus === 'IN_PROGRESS') {
    return { allowed: false, reason: 'Policy blocked: A recovery action is already in progress.' };
  }

  // 6. Every decision must have a stop condition.
  if (!decision.stopCondition || decision.stopCondition.trim() === '') {
    return { allowed: false, reason: 'Policy blocked: Decision missing stop condition.' };
  }

  return { allowed: true };
}
