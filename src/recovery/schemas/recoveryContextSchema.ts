import { z } from 'zod';
import { FailureCategory } from '@prisma/client';

export const PaymentContextSchema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string().nullable(),
  amount: z.number().int(),
  currency: z.string(),
  method: z.string().nullable(),
  bank: z.string().nullable(),
  wallet: z.string().nullable(),
  status: z.string(),
  razorpayCreatedAt: z.string(), // ISO string format
});

export const FailureContextSchema = z.object({
  category: z.nativeEnum(FailureCategory),
  errorCode: z.string().nullable(),
  errorDescription: z.string().nullable(),
  errorSource: z.string().nullable(),
  errorStep: z.string().nullable(),
  errorReason: z.string().nullable(),
});

export const CustomerContextSchema = z.object({
  tenureDays: z.number(),
  totalSuccessfulPayments: z.number().int(),
  totalFailedPayments: z.number().int(),
  lifetimeValue: z.number().int(), // in paise
  averageOrderValue: z.number(),  // in paise (can be float or rounded)
  hasEmail: z.boolean(),
  hasContact: z.boolean(),
});

export const ActionSummarySchema = z.object({
  action: z.string(),
  result: z.string(),
});

export const RecoveryStateContextSchema = z.object({
  recoveryAttemptCount: z.number().int(),
  maxRecoveryAttempts: z.number().int(),
  attemptsRemaining: z.number().int(),
  previousActionsThisCase: z.array(ActionSummarySchema),
  existingRecoveryLinkUrl: z.string().nullable(),
  caseAgeMinutes: z.number(),
  revenueAtRisk: z.number().int(), // in paise
  baselineRecoveryProbability: z.number().min(0.0).max(1.0),
});

export const PolicyContextSchema = z.object({
  recoveryWindowRemainingMinutes: z.number(),
  withinContactLimit: z.boolean(),
  isHighValue: z.boolean(),
});

export const RecoveryContextSchema = z.object({
  schemaVersion: z.literal(1),
  payment: PaymentContextSchema,
  failure: FailureContextSchema,
  customer: CustomerContextSchema,
  recovery: RecoveryStateContextSchema,
  policy: PolicyContextSchema,
});

export type RecoveryContext = z.infer<typeof RecoveryContextSchema>;
export type ActionSummary = z.infer<typeof ActionSummarySchema>;
