import { Payment, RecoveryCase } from '@prisma/client';
import { RecoveryDecision, RecoveryAction, Recoverability } from './recoveryTypes';
import { calculateRecoveryProbability, determinePriority } from './recoveryScorer';
import { FailureCategory } from '../models/internalTypes';

export function decideRecoveryAction(
  recoveryCase: RecoveryCase,
  payment: Payment,
  customerPayments: Payment[]
): RecoveryDecision {
  const category = recoveryCase.failureCategory as FailureCategory;
  const probability = calculateRecoveryProbability(category, customerPayments);
  const priority = determinePriority(recoveryCase.revenueAtRisk);

  let recoverability: Recoverability = 'RECOVERABLE';
  let recommendedAction: RecoveryAction = 'NO_ACTION';
  let preferredPaymentMethod: string | undefined = undefined;
  let maxAttempts = 1;
  let reason = '';
  let confidence = 0.9;
  let stopCondition = 'Stop after max attempts reached or immediately upon successful payment.';

  // Determine alternative payment method based on history
  const successfulMethods = customerPayments
    .filter(p => p.status === 'CAPTURED' && p.method)
    .map(p => p.method as string);
  
  if (successfulMethods.length > 0) {
    const methodCounts = successfulMethods.reduce((acc, method) => {
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Find the most successful method different from the current failed method
    const sortedMethods = Object.entries(methodCounts).sort((a, b) => b[1] - a[1]);
    for (const [method] of sortedMethods) {
      if (method !== payment.method) {
        preferredPaymentMethod = method;
        break;
      }
    }
  }

  switch (category) {
    case 'CUSTOMER_ABANDONMENT':
      recommendedAction = (priority === 'CRITICAL' || priority === 'HIGH') 
        ? 'CUSTOMER_REENGAGEMENT' 
        : 'CREATE_PAYMENT_LINK';
      reason = 'Customer abandoned checkout. Re-engaging with payment link.';
      break;

    case 'BANK_DECLINE':
      recommendedAction = 'ALTERNATIVE_PAYMENT_METHOD';
      reason = 'Bank declined the payment. Retrying the same payment method is not recommended.';
      break;

    case 'GATEWAY_FAILURE':
      recommendedAction = 'RETRY_PAYMENT';
      reason = 'Gateway error detected. Retrying payment is generally safe.';
      break;

    case 'AUTHENTICATION_FAILURE':
      recommendedAction = preferredPaymentMethod ? 'ALTERNATIVE_PAYMENT_METHOD' : 'CUSTOMER_REENGAGEMENT';
      reason = 'Authentication failed. Asking customer to retry or use another method.';
      break;

    case 'INSUFFICIENT_FUNDS':
      recommendedAction = preferredPaymentMethod ? 'ALTERNATIVE_PAYMENT_METHOD' : 'CUSTOMER_REENGAGEMENT';
      reason = 'Insufficient funds. Customer needs to use another method or add funds.';
      break;

    case 'INVALID_PAYMENT_DETAILS':
      recommendedAction = 'CUSTOMER_REENGAGEMENT';
      reason = 'Invalid payment details provided. Customer correction required.';
      break;

    case 'TIMEOUT':
      recommendedAction = 'RETRY_PAYMENT';
      reason = 'Payment timed out. A safe retry can be attempted.';
      break;

    case 'RISK_REJECTION':
      recoverability = 'NOT_RECOVERABLE';
      recommendedAction = 'NO_ACTION';
      maxAttempts = 0;
      reason = 'Risk engine rejected the payment. Do not automatically retry.';
      confidence = 0.99;
      stopCondition = 'Do not attempt recovery.';
      break;

    case 'UNKNOWN':
    default:
      recoverability = 'REVIEW_REQUIRED';
      recommendedAction = 'ESCALATE';
      maxAttempts = 0;
      reason = 'Unknown failure category requires manual review.';
      confidence = 0.8;
      stopCondition = 'Wait for manual review.';
      break;
  }

  return {
    failureCategory: category,
    recoverability,
    recoveryProbability: probability,
    priority,
    recommendedAction,
    preferredPaymentMethod,
    maxAttempts,
    reason,
    confidence,
    stopCondition
  };
}
