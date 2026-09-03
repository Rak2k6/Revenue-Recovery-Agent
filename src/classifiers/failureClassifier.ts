import { FailureCategory } from '../models/internalTypes';
import { NormalizedPaymentEvent } from '../models/internalTypes';

/**
 * Deterministic rule-based failure classifier.
 * Uses structured Razorpay signals: error_source, error_step, error_reason, error_code.
 *
 * Milestone 1: pure rule engine.
 * Milestone 2: this function can remain as a fast-path; an LLM can handle
 *              ambiguous/contextual cases that don't match any rule below.
 */
export function classifyFailure(
  error: NormalizedPaymentEvent['error']
): FailureCategory {
  if (!error) return 'UNKNOWN';

  const { source, step, reason, code } = error;

  // Customer deliberately cancelled or closed the checkout
  if (
    reason === 'payment_cancelled' ||
    (source === 'customer' && step === 'payment_authentication')
  ) {
    return 'CUSTOMER_ABANDONMENT';
  }

  // Bank explicitly declined the payment
  if (source === 'bank' && step === 'payment_authorization') {
    return 'BANK_DECLINE';
  }

  // Risk/fraud engine blocked the payment — do NOT auto-retry
  if (
    source === 'business' ||
    reason === 'risk_controls' ||
    code === 'GATEWAY_ERROR' && source === 'issuer'
  ) {
    return 'RISK_REJECTION';
  }

  // Gateway or processor technical failure
  if (source === 'gateway' || source === 'issuer') {
    return 'GATEWAY_FAILURE';
  }

  // Auth step failed (OTP, 3DS) but not customer-cancelled
  if (step === 'payment_authentication') {
    return 'AUTHENTICATION_FAILURE';
  }

  if (reason === 'insufficient_funds') return 'INSUFFICIENT_FUNDS';
  if (reason === 'payment_timeout')    return 'TIMEOUT';
  if (reason === 'invalid_details')    return 'INVALID_PAYMENT_DETAILS';

  return 'UNKNOWN';
}
