import { prisma } from '../db/prismaClient';
import { RazorpayWebhookPayload } from '../integrations/razorpay/types';
import { normalizePaymentEvent } from '../integrations/razorpay/normalizer';
import { upsertCustomerAndPayment } from './paymentService';
import { handleFailedPayment, handleCapturedPayment } from './recoveryService';
import { logger } from '../utils/logger';
import { WebhookIngestionResult } from '../models/internalTypes';
import { Prisma } from '@prisma/client';

const SUPPORTED_PAYMENT_EVENTS = new Set([
  'payment.created',
  'payment.authorized',
  'payment.captured',
  'payment.failed',
  'payment.refunded',
]);

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  );
}

/**
 * Core webhook processing pipeline.
 *
 * Idempotency: atomic INSERT on idempotencyKey.
 * The DB unique constraint handles concurrent duplicate deliveries.
 * No SELECT-then-INSERT race condition.
 *
 * Error semantics (per design correction):
 *   - Duplicate → return skipped=true (caller returns 200)
 *   - Unknown event type → store + return (caller returns 200)
 *   - Normalizer error → re-throw (caller returns 500, triggers Razorpay retry)
 *   - DB failure → re-throw (caller returns 500)
 */
export async function processWebhookEvent(
  body: RazorpayWebhookPayload,
  receivedAt: Date
): Promise<WebhookIngestionResult> {
  const paymentId = body.payload?.payment?.entity?.id ?? 'unknown';
  // Idempotency key: prefer top-level event ID; fall back to eventType:paymentId
  const idempotencyKey = body.id ?? `${body.event}:${paymentId}`;

  // ── Atomic INSERT ──────────────────────────────────────────────────────────
  let webhookEvent;
  try {
    webhookEvent = await prisma.webhookEvent.create({
      data: {
        idempotencyKey,
        razorpayEventId: body.id ?? null,
        eventType: body.event,
        payload: body as unknown as Prisma.InputJsonValue,
        signatureVerified: true,
        receivedAt,
        processed: false,
      },
    });
  } catch (err) {
    if (isPrismaUniqueConstraintError(err)) {
      logger.info({ idempotencyKey }, 'Duplicate webhook — skipping');
      return { skipped: true, eventId: idempotencyKey, paymentId: null, recoveryCaseId: null };
    }
    throw err; // DB failure → propagate → 500
  }

  // ── Unknown event type ─────────────────────────────────────────────────────
  if (!SUPPORTED_PAYMENT_EVENTS.has(body.event)) {
    logger.warn({ eventType: body.event }, 'Unknown event type — stored but not processed');
    await markProcessed(webhookEvent.id);
    return { skipped: false, eventId: webhookEvent.id, paymentId: null, recoveryCaseId: null };
  }

  // ── Normalize — throws on malformed payload (caller returns 500) ───────────
  const normalized = normalizePaymentEvent(body);

  // ── Upsert Customer + Payment ──────────────────────────────────────────────
  const { payment } = await upsertCustomerAndPayment(normalized);

  // ── Recovery Case (failed or captured payments) ───────────────────────────
  let recoveryCase = null;
  if (body.event === 'payment.failed') {
    recoveryCase = await handleFailedPayment(payment.id, normalized);
  } else if (body.event === 'payment.captured') {
    recoveryCase = await handleCapturedPayment(payment.id, normalized, body);
  }

  // ── Mark processed ─────────────────────────────────────────────────────────
  await markProcessed(webhookEvent.id);

  logger.info(
    { eventId: webhookEvent.id, eventType: body.event, internalPaymentId: payment.id },
    'Webhook processed'
  );

  return {
    skipped: false,
    eventId: webhookEvent.id,
    paymentId: payment.id,
    recoveryCaseId: recoveryCase?.id ?? null,
  };
}

async function markProcessed(id: string) {
  await prisma.webhookEvent.update({
    where: { id },
    data: { processed: true, processedAt: new Date() },
  });
}
