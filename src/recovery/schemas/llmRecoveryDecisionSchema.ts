import { z } from 'zod';
import { FailureCategory } from '@prisma/client';

export const ReasonCodeEnum = z.enum([
  'CUSTOMER_HISTORY',
  'RECOVERABLE_FAILURE',
  'LOW_HISTORY',
  'HIGH_VALUE',
  'REPEATED_FAILURE',
  'WINDOW_EXPIRING',
  'NO_CONTACT_METHOD',
  'PREVIOUS_RECOVERY_ATTEMPT',
  'LOW_CONFIDENCE',
  'RISK_REJECTED',
  'AUTHENTICATION_ISSUE',
  'BANK_DECLINED',
  'GATEWAY_ISSUES',
  'ABANDONED_CHECKOUT',
  'UNKNOWN_FAILURE',
]);

export const LLMActionEnum = z.enum([
  'NO_ACTION',
  'CREATE_PAYMENT_LINK',
  'SEND_RECOVERY_REMINDER',
  'STOP',
]);

export const LLMRecoverabilityEnum = z.enum(['high', 'medium', 'low']);

export const LLMRecoveryDecisionSchema = z.object({
  schemaVersion: z.literal(1),
  failure_class: z.nativeEnum(FailureCategory),
  recoverability: LLMRecoverabilityEnum,
  confidence: z.number().min(0.0).max(1.0),
  recovery_probability: z.number().min(0.0).max(1.0),
  recommended_action: LLMActionEnum,
  reason_codes: z.array(ReasonCodeEnum).min(1).max(5),
  reasoning: z.string().max(500),
});

export type ReasonCode = z.infer<typeof ReasonCodeEnum>;
export type LLMAction = z.infer<typeof LLMActionEnum>;
export type LLMRecoverability = z.infer<typeof LLMRecoverabilityEnum>;
export type LLMRecoveryDecision = z.infer<typeof LLMRecoveryDecisionSchema>;
