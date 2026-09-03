import { prisma } from '../db/prismaClient';
import { FailureCategory } from '@prisma/client';
import { RecoveryContext, RecoveryContextSchema } from './schemas/recoveryContextSchema';

export const DEFAULT_RECOVERY_WINDOW_MINUTES = 1440; // 24 hours
export const HIGH_VALUE_THRESHOLD_PAISE = 500000; // 5,000 INR (in paise)

/**
 * Deterministic baseline recovery probability scoring heuristic.
 * 
 * Factors & Weights:
 * 1. Base Failure Category Score:
 *    - GATEWAY_FAILURE: 0.8
 *    - TIMEOUT: 0.7
 *    - CUSTOMER_ABANDONMENT / AUTHENTICATION_FAILURE: 0.6
 *    - INVALID_PAYMENT_DETAILS: 0.5
 *    - BANK_DECLINE: 0.4
 *    - INSUFFICIENT_FUNDS: 0.3
 *    - UNKNOWN: 0.2
 *    - RISK_REJECTION: 0.0
 * 2. Customer Historical Success Rate Modifier:
 *    - +/- 0.15 based on historical (captured / total) ratio
 * 3. Recovery Attempt Penalty:
 *    - -0.1 per prior attempt
 * 4. Recovery Window Expiry Penalty:
 *    - 50% penalty if window remaining <= 0
 */
export function calculateBaselineProbability(
  failureCategory: FailureCategory,
  totalSuccessfulPayments: number,
  totalFailedPayments: number,
  recoveryAttemptCount: number,
  recoveryWindowRemainingMinutes: number
): number {
  let baseScore = 0.5;

  switch (failureCategory) {
    case 'GATEWAY_FAILURE':
      baseScore = 0.8;
      break;
    case 'TIMEOUT':
      baseScore = 0.7;
      break;
    case 'CUSTOMER_ABANDONMENT':
    case 'AUTHENTICATION_FAILURE':
      baseScore = 0.6;
      break;
    case 'INVALID_PAYMENT_DETAILS':
      baseScore = 0.5;
      break;
    case 'BANK_DECLINE':
      baseScore = 0.4;
      break;
    case 'INSUFFICIENT_FUNDS':
      baseScore = 0.3;
      break;
    case 'UNKNOWN':
      baseScore = 0.2;
      break;
    case 'RISK_REJECTION':
      baseScore = 0.0;
      break;
  }

  // Adjust for historical success rate
  const totalPrior = totalSuccessfulPayments + totalFailedPayments;
  if (totalPrior > 0) {
    const successRatio = totalSuccessfulPayments / totalPrior;
    const historyModifier = (successRatio - 0.5) * 0.3;
    baseScore += historyModifier;
  }

  // Penalty for multiple attempts
  if (recoveryAttemptCount > 0) {
    baseScore -= recoveryAttemptCount * 0.1;
  }

  // Penalty if window expired
  if (recoveryWindowRemainingMinutes <= 0) {
    baseScore *= 0.5;
  }

  return Number(Math.min(1.0, Math.max(0.0, baseScore)).toFixed(2));
}

/**
 * Builds a canonical, validated RecoveryContext object for a given RecoveryCase.
 * 
 * @param recoveryCaseId The ID of the RecoveryCase
 * @param now Optional date override for testing time calculations
 */
export async function buildRecoveryContext(
  recoveryCaseId: string,
  now: Date = new Date()
): Promise<RecoveryContext> {
  // 1. Data Fetching
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: { id: recoveryCaseId },
    include: {
      payment: {
        include: { customer: true },
      },
      auditLogs: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!recoveryCase || !recoveryCase.payment) {
    throw new Error(`RecoveryCase or associated Payment not found for ID: ${recoveryCaseId}`);
  }

  const currentPayment = recoveryCase.payment;
  
  // Primary failure cutoff timestamp
  const failureTimestamp = currentPayment.razorpayCreatedAt ?? currentPayment.createdAt;

  // 2. Customer History Metrics (filtered using failureTimestamp cutoff)
  let totalSuccessfulPayments = 0;
  let totalFailedPayments = 0;
  let lifetimeValue = 0;
  let averageOrderValue = 0;
  let tenureDays = 0;

  if (currentPayment.customerId) {
    const allCustomerPayments = await prisma.payment.findMany({
      where: { customerId: currentPayment.customerId },
    });

    const historicalPayments = allCustomerPayments.filter((p) => {
      if (p.id === currentPayment.id) return false;
      const pTimestamp = p.razorpayCreatedAt ?? p.createdAt;
      return pTimestamp.getTime() < failureTimestamp.getTime();
    });

    if (historicalPayments.length > 0) {
      const successful = historicalPayments.filter((p) => p.status === 'CAPTURED');
      const failed = historicalPayments.filter((p) => p.status === 'FAILED');

      totalSuccessfulPayments = successful.length;
      totalFailedPayments = failed.length;
      lifetimeValue = successful.reduce((sum, p) => sum + p.amount, 0);

      if (totalSuccessfulPayments > 0) {
        averageOrderValue = Number((lifetimeValue / totalSuccessfulPayments).toFixed(2));
      }

      // Calculate tenure using earliest historical payment timestamp
      const earliestTimestamp = historicalPayments.reduce((min, p) => {
        const ts = p.razorpayCreatedAt ?? p.createdAt;
        return ts.getTime() < min.getTime() ? ts : min;
      }, failureTimestamp);

      const diffMs = failureTimestamp.getTime() - earliestTimestamp.getTime();
      tenureDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // 3. Recovery History Audit Mapping
  const previousActionsThisCase = recoveryCase.auditLogs.map((log) => ({
    action: log.action,
    result: log.status,
  }));

  // 4. Time & Recovery Window Calculations
  const caseAgeMinutes = Math.max(
    0,
    Math.floor((now.getTime() - failureTimestamp.getTime()) / (1000 * 60))
  );

  const envWindow = process.env.RECOVERY_WINDOW_MINUTES;
  const configuredWindowMinutes = envWindow ? parseInt(envWindow, 10) : DEFAULT_RECOVERY_WINDOW_MINUTES;
  const recoveryWindowRemainingMinutes = Math.max(0, configuredWindowMinutes - caseAgeMinutes);

  // 5. Baseline Recovery Probability
  const baselineRecoveryProbability = calculateBaselineProbability(
    recoveryCase.failureCategory,
    totalSuccessfulPayments,
    totalFailedPayments,
    recoveryCase.recoveryAttemptCount,
    recoveryWindowRemainingMinutes
  );

  // 6. Policy Context
  const attemptsRemaining = Math.max(0, recoveryCase.maxRecoveryAttempts - recoveryCase.recoveryAttemptCount);
  const withinContactLimit = recoveryCase.recoveryAttemptCount < recoveryCase.maxRecoveryAttempts;
  const isHighValue = recoveryCase.revenueAtRisk >= HIGH_VALUE_THRESHOLD_PAISE;

  // 7. Assemble Raw Context Object (Zero PII)
  const rawContext = {
    schemaVersion: 1 as const,
    payment: {
      razorpayPaymentId: currentPayment.razorpayPaymentId,
      razorpayOrderId: currentPayment.razorpayOrderId ?? null,
      amount: currentPayment.amount,
      currency: currentPayment.currency,
      method: currentPayment.method ?? null,
      bank: currentPayment.bank ?? null,
      wallet: currentPayment.wallet ?? null,
      status: currentPayment.status,
      razorpayCreatedAt: failureTimestamp.toISOString(),
    },
    failure: {
      category: recoveryCase.failureCategory,
      errorCode: currentPayment.errorCode ?? null,
      errorDescription: currentPayment.errorDescription ?? null,
      errorSource: currentPayment.errorSource ?? null,
      errorStep: currentPayment.errorStep ?? null,
      errorReason: currentPayment.errorReason ?? null,
    },
    customer: {
      tenureDays,
      totalSuccessfulPayments,
      totalFailedPayments,
      lifetimeValue,
      averageOrderValue,
      hasEmail: Boolean(currentPayment.customer?.email),
      hasContact: Boolean(currentPayment.customer?.contact),
    },
    recovery: {
      recoveryAttemptCount: recoveryCase.recoveryAttemptCount,
      maxRecoveryAttempts: recoveryCase.maxRecoveryAttempts,
      attemptsRemaining,
      previousActionsThisCase,
      existingRecoveryLinkUrl: recoveryCase.recoveryLinkUrl ?? null,
      caseAgeMinutes,
      revenueAtRisk: recoveryCase.revenueAtRisk,
      baselineRecoveryProbability,
    },
    policy: {
      recoveryWindowRemainingMinutes,
      withinContactLimit,
      isHighValue,
    },
  };

  // 8. Validate against Zod schema
  return RecoveryContextSchema.parse(rawContext);
}
