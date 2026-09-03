import { prisma } from '../db/prismaClient';
import { NormalizedPaymentEvent } from '../models/internalTypes';
import { classifyFailure } from '../classifiers/failureClassifier';
import { isRecoverable } from '../recovery/recoverabilityChecker';
import { calculateRevenueAtRisk } from '../recovery/revenueRisk';
import { logger } from '../utils/logger';
import { FailureCategory } from '@prisma/client';

/**
 * Handles a failed payment event.
 *
 * Flow:
 *   Classify → Check recoverability → Calculate revenue-at-risk → Upsert RecoveryCase
 *
 * Returns null if the failure is NOT recoverable (e.g. fraud/risk rejection).
 * In that case we still have the Payment record, but no RecoveryCase.
 */
export async function handleFailedPayment(paymentId: string, event: NormalizedPaymentEvent) {
  const category = classifyFailure(event.error);

  if (!isRecoverable(category)) {
    logger.info(
      { paymentId, category },
      'Payment failure is not recoverable — skipping RecoveryCase creation'
    );
    return null;
  }

  const revenueAtRisk = calculateRevenueAtRisk(event);

  const recoveryCase = await prisma.recoveryCase.upsert({
    where: { paymentId },
    create: {
      paymentId,
      failureCategory: category as FailureCategory,
      revenueAtRisk,
      recoverabilityStatus: 'PENDING_ASSESSMENT',
    },
    update: {
      failureCategory: category as FailureCategory,
      revenueAtRisk,
    },
  });

  logger.info(
    { recoveryCaseId: recoveryCase.id, paymentId, category, revenueAtRisk },
    'RecoveryCase created/updated'
  );

  return recoveryCase;
}

/**
 * Handles a captured payment event.
 *
 * Demonstrably correlates captured payment with a RecoveryCase via notes or payment_link_id.
 * Marks the case RECOVERED and logs audit entry.
 */
export async function handleCapturedPayment(paymentId: string, event: NormalizedPaymentEvent, rawPayload?: any) {
  const entity = rawPayload?.payload?.payment?.entity;
  const recoveryCaseIdFromNotes = entity?.notes?.recoveryCaseId;
  const plinkId = entity?.payment_link_id || entity?.plink_id;

  let recoveryCase = null;

  if (recoveryCaseIdFromNotes) {
    recoveryCase = await prisma.recoveryCase.findUnique({
      where: { id: recoveryCaseIdFromNotes },
    });
  }

  if (!recoveryCase && plinkId) {
    recoveryCase = await prisma.recoveryCase.findFirst({
      where: { recoveryLinkId: plinkId },
    });
  }

  if (!recoveryCase && entity?.notes?.paymentId) {
    recoveryCase = await prisma.recoveryCase.findUnique({
      where: { paymentId: entity.notes.paymentId },
    });
  }

  // Only proceed if payment is demonstrably associated with a RecoveryCase
  if (!recoveryCase) {
    logger.info({ paymentId }, 'Captured payment not associated with any active RecoveryCase — skipping');
    return null;
  }

  if (recoveryCase.recoverabilityStatus === 'RECOVERED') {
    return recoveryCase;
  }

  const updatedCase = await prisma.recoveryCase.update({
    where: { id: recoveryCase.id },
    data: {
      recoverabilityStatus: 'RECOVERED',
      amountRecovered: event.amount,
    },
  });

  await prisma.recoveryAuditLog.create({
    data: {
      recoveryCaseId: recoveryCase.id,
      action: 'RECOVERY_SUCCESSFUL',
      status: 'COMPLETED',
      amountRecovered: event.amount,
      metadata: {
        capturedPaymentId: event.razorpayPaymentId,
        amount: event.amount,
      },
    },
  });

  logger.info({ recoveryCaseId: updatedCase.id, amountRecovered: event.amount }, 'RecoveryCase marked as RECOVERED');

  return updatedCase;
}
