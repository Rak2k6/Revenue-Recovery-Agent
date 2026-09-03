export type RecoveryAction =
  | 'RETRY_PAYMENT'
  | 'ALTERNATIVE_PAYMENT_METHOD'
  | 'CREATE_PAYMENT_LINK'
  | 'CUSTOMER_REENGAGEMENT'
  | 'ESCALATE'
  | 'NO_ACTION';

export type RecoveryPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Recoverability = 'RECOVERABLE' | 'NOT_RECOVERABLE' | 'REVIEW_REQUIRED';

export interface RecoveryDecision {
  failureCategory: string;
  recoverability: Recoverability;
  recoveryProbability: number;
  priority: RecoveryPriority;
  recommendedAction: RecoveryAction;
  preferredPaymentMethod?: string;
  maxAttempts: number;
  reason: string;
  confidence: number;
  stopCondition: string;
}
