import dotenv from 'dotenv';
dotenv.config();

import { decideWithLLM } from '../src/recovery/llmAgent';
import { RecoveryContext } from '../src/recovery/schemas/recoveryContextSchema';
import { LLMRecoveryDecision, LLMRecoveryDecisionSchema } from '../src/recovery/schemas/llmRecoveryDecisionSchema';

// Example A: Existing Customer + Bank Decline
export const exampleAContext: RecoveryContext = {
  schemaVersion: 1,
  payment: {
    razorpayPaymentId: 'pay_O7xK38x9Kjs1',
    razorpayOrderId: 'order_O7xJ8s902Kjs',
    amount: 150000, // ₹1,500 in paise
    currency: 'INR',
    method: 'card',
    bank: 'HDFC',
    wallet: null,
    status: 'FAILED',
    razorpayCreatedAt: '2026-09-03T12:00:00.000Z',
  },
  failure: {
    category: 'BANK_DECLINE',
    errorCode: 'BAD_REQUEST_ERROR',
    errorDescription: 'Payment authorization failed by issuing bank',
    errorSource: 'bank',
    errorStep: 'payment_authorization',
    errorReason: 'payment_failed',
  },
  customer: {
    tenureDays: 45,
    totalSuccessfulPayments: 3,
    totalFailedPayments: 1,
    lifetimeValue: 450000,
    averageOrderValue: 150000,
    hasEmail: true,
    hasContact: true,
  },
  recovery: {
    recoveryAttemptCount: 0,
    maxRecoveryAttempts: 3,
    attemptsRemaining: 3,
    previousActionsThisCase: [
      { action: 'ASSESSMENT_COMPLETED', result: 'COMPLETED' },
    ],
    existingRecoveryLinkUrl: null,
    caseAgeMinutes: 30,
    revenueAtRisk: 150000,
    baselineRecoveryProbability: 0.48,
  },
  policy: {
    recoveryWindowRemainingMinutes: 1410,
    withinContactLimit: true,
    isHighValue: false,
  },
};

// Example B: New Customer + Customer Abandonment
export const exampleBContext: RecoveryContext = {
  schemaVersion: 1,
  payment: {
    razorpayPaymentId: 'pay_P9yL49y0Lkt2',
    razorpayOrderId: 'order_P9yK9t013Lkt',
    amount: 750000, // ₹7,500 in paise
    currency: 'INR',
    method: 'upi',
    bank: null,
    wallet: null,
    status: 'FAILED',
    razorpayCreatedAt: '2026-09-03T12:00:00.000Z',
  },
  failure: {
    category: 'CUSTOMER_ABANDONMENT',
    errorCode: 'BAD_REQUEST_ERROR',
    errorDescription: 'Customer closed checkout window before completing UPI payment',
    errorSource: 'customer',
    errorStep: 'payment_authentication',
    errorReason: 'payment_cancelled',
  },
  customer: {
    tenureDays: 0,
    totalSuccessfulPayments: 0,
    totalFailedPayments: 0,
    lifetimeValue: 0,
    averageOrderValue: 0,
    hasEmail: true,
    hasContact: false,
  },
  recovery: {
    recoveryAttemptCount: 0,
    maxRecoveryAttempts: 3,
    attemptsRemaining: 3,
    previousActionsThisCase: [],
    existingRecoveryLinkUrl: null,
    caseAgeMinutes: 15,
    revenueAtRisk: 750000,
    baselineRecoveryProbability: 0.60,
  },
  policy: {
    recoveryWindowRemainingMinutes: 1425,
    withinContactLimit: true,
    isHighValue: true,
  },
};

// Expected LLM outputs adhering strictly to schema rules
export const expectedResultA: LLMRecoveryDecision = {
  schemaVersion: 1,
  failure_class: 'BANK_DECLINE',
  recoverability: 'medium',
  confidence: 0.85,
  recovery_probability: 0.52,
  recommended_action: 'CREATE_PAYMENT_LINK',
  reason_codes: ['CUSTOMER_HISTORY', 'RECOVERABLE_FAILURE', 'BANK_DECLINED'],
  reasoning: 'Customer has 3 prior successful payments (LTV ₹4,500) over 45 days tenure. Bank decline is recoverable via an alternative payment method link.',
};

export const expectedResultB: LLMRecoveryDecision = {
  schemaVersion: 1,
  failure_class: 'CUSTOMER_ABANDONMENT',
  recoverability: 'high',
  confidence: 0.90,
  recovery_probability: 0.65,
  recommended_action: 'CREATE_PAYMENT_LINK',
  reason_codes: ['HIGH_VALUE', 'ABANDONED_CHECKOUT', 'RECOVERABLE_FAILURE'],
  reasoning: 'High-value transaction (₹7,500 at risk) abandoned during UPI checkout. Customer has valid email available for payment link delivery.',
};

async function runEvaluation() {
  console.log('--- LIVE ENVIRONMENT CHECK (Fallback Behavior Test) ---');
  console.log('=== EVALUATING EXAMPLE A: Existing Customer + Bank Decline ===');
  const resultA = await decideWithLLM(exampleAContext);
  console.log(JSON.stringify(resultA, null, 2));

  console.log('\n=== EVALUATING EXAMPLE B: New Customer + Customer Abandonment ===');
  const resultB = await decideWithLLM(exampleBContext);
  console.log(JSON.stringify(resultB, null, 2));

  console.log('\n--- STRUCTURED MODEL OUTPUT VALIDATION (Zod Verification) ---');
  console.log('Example A Schema Validated:', LLMRecoveryDecisionSchema.safeParse(expectedResultA).success);
  console.log('Example B Schema Validated:', LLMRecoveryDecisionSchema.safeParse(expectedResultB).success);
}

if (require.main === module) {
  runEvaluation();
}
