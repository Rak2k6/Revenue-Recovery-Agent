import { Payment } from '@prisma/client';
import { FailureCategory } from '../models/internalTypes';
import { RecoveryPriority } from './recoveryTypes';

export function calculateRecoveryProbability(
  failureCategory: FailureCategory,
  customerPayments: Payment[]
): number {
  let baseScore = 0.5;

  switch (failureCategory) {
    case 'CUSTOMER_ABANDONMENT':
      baseScore = 0.6;
      break;
    case 'BANK_DECLINE':
      baseScore = 0.4;
      break;
    case 'GATEWAY_FAILURE':
      baseScore = 0.8;
      break;
    case 'AUTHENTICATION_FAILURE':
      baseScore = 0.6;
      break;
    case 'INSUFFICIENT_FUNDS':
      baseScore = 0.3;
      break;
    case 'INVALID_PAYMENT_DETAILS':
      baseScore = 0.5;
      break;
    case 'TIMEOUT':
      baseScore = 0.7;
      break;
    case 'RISK_REJECTION':
      baseScore = 0.0;
      break;
    case 'UNKNOWN':
      baseScore = 0.2;
      break;
  }

  // Adjust based on customer history if available
  if (customerPayments.length > 0) {
    const successfulPayments = customerPayments.filter(p => p.status === 'CAPTURED');
    const successRate = successfulPayments.length / customerPayments.length;
    
    // Adjust up to +/- 0.2 based on historical success rate
    const historyModifier = (successRate - 0.5) * 0.4;
    baseScore = Math.min(1.0, Math.max(0.0, baseScore + historyModifier));
  }

  return Number(baseScore.toFixed(2));
}

export function determinePriority(amountPaise: number): RecoveryPriority {
  // Amount is in paise
  if (amountPaise >= 1000000) return 'CRITICAL'; // >= 10,000 INR
  if (amountPaise >= 500000) return 'HIGH';      // >= 5,000 INR
  if (amountPaise >= 100000) return 'MEDIUM';    // >= 1,000 INR
  return 'LOW';
}
