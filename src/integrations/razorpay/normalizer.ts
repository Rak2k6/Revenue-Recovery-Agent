import { RazorpayWebhookPayload } from './types';
import { NormalizedPaymentEvent, InternalPaymentStatus } from '../../models/internalTypes';

function mapStatus(raw: string): InternalPaymentStatus {
  const map: Record<string, InternalPaymentStatus> = {
    created: 'CREATED',
    authorized: 'AUTHORIZED',
    captured: 'CAPTURED',
    failed: 'FAILED',
    refunded: 'REFUNDED',
  };
  return map[raw] ?? 'CREATED';
}

/**
 * Converts a raw Razorpay webhook payload into our internal normalized model.
 * This is the ONLY function allowed to read Razorpay-specific field names.
 * Throws if the payment entity is missing (caller should return 500).
 */
export function normalizePaymentEvent(body: RazorpayWebhookPayload): NormalizedPaymentEvent {
  const entity = body.payload?.payment?.entity;
  if (!entity) {
    throw new Error('Webhook payload missing payment entity');
  }

  return {
    razorpayPaymentId: entity.id,
    razorpayOrderId: entity.order_id ?? null,
    amount: entity.amount,
    currency: entity.currency ?? 'INR',
    status: mapStatus(entity.status),
    captured: entity.captured ?? false,
    method: entity.method ?? null,
    bank: entity.bank ?? null,
    wallet: entity.wallet ?? null,
    amountRefunded: entity.amount_refunded ?? 0,
    refundStatus: entity.refund_status ?? null,
    customerEmail: entity.email ?? null,
    customerContact: entity.contact ?? null,
    razorpayCreatedAt: entity.created_at
      ? new Date(entity.created_at * 1000)
      : null,
    error: entity.error_code
      ? {
          code: entity.error_code,
          description: entity.error_description ?? null,
          source: entity.error_source ?? null,
          step: entity.error_step ?? null,
          reason: entity.error_reason ?? null,
        }
      : null,
  };
}
