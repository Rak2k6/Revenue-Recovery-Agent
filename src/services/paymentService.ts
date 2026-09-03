import { prisma } from '../db/prismaClient';
import { NormalizedPaymentEvent } from '../models/internalTypes';
import { PaymentStatus } from '@prisma/client';

function mapStatus(s: string): PaymentStatus {
  const map: Record<string, PaymentStatus> = {
    CREATED: 'CREATED',
    AUTHORIZED: 'AUTHORIZED',
    CAPTURED: 'CAPTURED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
  };
  return map[s] ?? 'CREATED';
}

/**
 * Upserts the Customer (by email) and Payment (by razorpayPaymentId).
 * Returns the internal Payment record.
 */
export async function upsertCustomerAndPayment(event: NormalizedPaymentEvent) {
  // --- Customer ---
  let customer = null;
  if (event.customerEmail) {
    customer = await prisma.customer.upsert({
      where: { email: event.customerEmail },
      create: {
        email: event.customerEmail,
        contact: event.customerContact,
      },
      update: {
        // Keep contact up-to-date; don't overwrite with null
        ...(event.customerContact ? { contact: event.customerContact } : {}),
      },
    });
  }

  // --- Payment ---
  const paymentData = {
    razorpayOrderId: event.razorpayOrderId,
    customerId: customer?.id ?? null,
    amount: event.amount,
    currency: event.currency,
    method: event.method,
    status: mapStatus(event.status),
    captured: event.captured,
    bank: event.bank,
    wallet: event.wallet,
    errorCode: event.error?.code ?? null,
    errorDescription: event.error?.description ?? null,
    errorSource: event.error?.source ?? null,
    errorStep: event.error?.step ?? null,
    errorReason: event.error?.reason ?? null,
    amountRefunded: event.amountRefunded,
    refundStatus: event.refundStatus,
    razorpayCreatedAt: event.razorpayCreatedAt,
  };

  const payment = await prisma.payment.upsert({
    where: { razorpayPaymentId: event.razorpayPaymentId },
    create: { razorpayPaymentId: event.razorpayPaymentId, ...paymentData },
    update: paymentData,
  });

  return { customer, payment };
}
