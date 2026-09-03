// Internal normalized event model.
// Everything outside the integration layer uses these types — never Razorpay's raw fields.

export type InternalPaymentStatus =
  | 'CREATED'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'REFUNDED';

export type FailureCategory =
  | 'CUSTOMER_ABANDONMENT'
  | 'BANK_DECLINE'
  | 'GATEWAY_FAILURE'
  | 'AUTHENTICATION_FAILURE'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_PAYMENT_DETAILS'
  | 'TIMEOUT'
  | 'RISK_REJECTION'
  | 'UNKNOWN';

export interface NormalizedPaymentEvent {
  razorpayPaymentId: string;
  razorpayOrderId: string | null;
  amount: number;           // paise
  currency: string;
  status: InternalPaymentStatus;
  captured: boolean;
  method: string | null;
  bank: string | null;
  wallet: string | null;
  amountRefunded: number;   // paise
  refundStatus: string | null;
  customerEmail: string | null;
  customerContact: string | null;
  razorpayCreatedAt: Date | null; // converted from Razorpay Unix timestamp
  error: {
    code: string | null;
    description: string | null;
    source: string | null;
    step: string | null;
    reason: string | null;
  } | null;
}

export interface WebhookIngestionResult {
  skipped: boolean;          // true = duplicate event, idempotently ignored
  eventId: string;
  paymentId: string | null;
  recoveryCaseId: string | null;
}
