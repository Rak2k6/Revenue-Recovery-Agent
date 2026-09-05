import { RecoveryCase, Payment } from '@prisma/client';
import { prisma } from '../db/prismaClient';
import { createPaymentLink } from '../integrations/razorpay/paymentLink';
import { PolicyDecision } from './schemas/policyDecisionSchema';
import { RecoveryContext } from './schemas/recoveryContextSchema';
import { NotificationService, defaultNotificationService } from '../integrations/notifications/notificationService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutionResult {
  success: boolean;
  recoveryCaseId: string;
  action: string;
  status: string;
  paymentLink?: {
    id: string;
    url: string;
  };
  revenueAtRisk?: number;
  message?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function logAudit(
  recoveryCaseId: string,
  action: string,
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'IN_PROGRESS',
  metadata: Record<string, unknown>
): Promise<void> {
  await prisma.recoveryAuditLog.create({
    data: { recoveryCaseId, action, status, metadata: metadata as any },
  });
}

function rejectedResult(
  recoveryCaseId: string,
  action: string,
  reason: string
): ExecutionResult {
  return {
    success: false,
    recoveryCaseId,
    action,
    status: 'SKIPPED',
    error: `Execution blocked: ${reason}`,
  };
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

/**
 * Phase 2F / Phase 3D Action Executor.
 *
 * This executor ONLY accepts an already-approved PolicyDecision.
 * It does NOT call decisionEngine, policyGuardrail, Groq, or any LLM.
 * The Policy Engine is the authorisation boundary; the executor protects
 * against stale state and race conditions.
 *
 * @param recoveryCaseId       ID of the RecoveryCase to operate on.
 * @param policyDecision       Validated PolicyDecision from Phase 2E. If not
 *                             approved, no side effects occur.
 * @param context              The RecoveryContext used to produce the decision
 *                             (provides trusted amounts and customer flags).
 * @param notificationService Optional NotificationService for dependency injection.
 */
export async function executeRecoveryAction(
  recoveryCaseId: string,
  policyDecision: PolicyDecision,
  context: RecoveryContext,
  notificationService: NotificationService = defaultNotificationService
): Promise<ExecutionResult> {

  // ── Guard 1: Policy rejection ─────────────────────────────────────────────
  if (!policyDecision.approved) {
    await logAudit(recoveryCaseId, 'EXECUTION_REJECTED', 'SKIPPED', {
      action: policyDecision.action,
      reason: policyDecision.reason,
      stopCondition: policyDecision.stopCondition,
    });
    return {
      success: false,
      recoveryCaseId,
      action: policyDecision.action,
      status: 'SKIPPED',
      message: policyDecision.reason,
    };
  }

  const approvedAction = policyDecision.action;

  // ── NO_ACTION / STOP: no side effects ────────────────────────────────────
  if (approvedAction === 'NO_ACTION' || approvedAction === 'STOP') {
    await logAudit(recoveryCaseId, 'EXECUTION_NO_ACTION', 'SKIPPED', {
      action: approvedAction,
      reason: policyDecision.reason,
    });
    return {
      success: true,
      recoveryCaseId,
      action: approvedAction,
      status: 'SKIPPED',
      message: policyDecision.reason,
    };
  }

  // ── Load fresh RecoveryCase (re-read to guard against stale state) ───────
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: { id: recoveryCaseId },
    include: { payment: { include: { customer: true } } },
  });

  if (!recoveryCase || !recoveryCase.payment) {
    return {
      success: false,
      recoveryCaseId,
      action: approvedAction,
      status: 'FAILED',
      error: 'RecoveryCase or Payment not found.',
    };
  }

  const payment = recoveryCase.payment;

  // ── Idempotency check: already has a recovery link ────────────────────────
  if (approvedAction === 'CREATE_PAYMENT_LINK' && recoveryCase.recoveryLinkId && recoveryCase.recoveryLinkUrl) {
    await logAudit(recoveryCaseId, 'ACTION_ALREADY_EXISTS', 'COMPLETED', {
      recoveryLinkId: recoveryCase.recoveryLinkId,
      recoveryLinkUrl: recoveryCase.recoveryLinkUrl,
      message: 'Payment link already created; returning existing link.',
    });
    return {
      success: true,
      recoveryCaseId: recoveryCase.id,
      action: approvedAction,
      status: 'COMPLETED',
      paymentLink: {
        id: recoveryCase.recoveryLinkId,
        url: recoveryCase.recoveryLinkUrl,
      },
      revenueAtRisk: recoveryCase.revenueAtRisk,
      message: 'Existing recovery payment link returned (idempotent).',
    };
  }

  // ── Executor-side invariant checks (stale-state protection) ──────────────
  if (payment.status !== 'FAILED') {
    await logAudit(recoveryCaseId, 'ACTION_BLOCKED', 'SKIPPED', {
      reason: 'Payment status is not FAILED.',
      paymentStatus: payment.status,
    });
    return rejectedResult(recoveryCaseId, approvedAction, 'Payment is not in FAILED state.');
  }

  if (recoveryCase.revenueAtRisk <= 0) {
    await logAudit(recoveryCaseId, 'ACTION_BLOCKED', 'SKIPPED', {
      reason: 'Revenue at risk is 0 or less.',
      revenueAtRisk: recoveryCase.revenueAtRisk,
    });
    return rejectedResult(recoveryCaseId, approvedAction, 'No revenue at risk.');
  }

  if (recoveryCase.recoveryAttemptCount >= recoveryCase.maxRecoveryAttempts) {
    await logAudit(recoveryCaseId, 'ACTION_BLOCKED', 'SKIPPED', {
      reason: `Max recovery attempts (${recoveryCase.maxRecoveryAttempts}) reached.`,
      current: recoveryCase.recoveryAttemptCount,
    });
    return rejectedResult(recoveryCaseId, approvedAction, `Max recovery attempts exceeded.`);
  }

  // ── SEND_RECOVERY_REMINDER (Phase 3D Integration) ─────────────────────────
  if (approvedAction === 'SEND_RECOVERY_REMINDER') {
    if (!recoveryCase.recoveryLinkUrl) {
      await logAudit(recoveryCaseId, 'ACTION_BLOCKED', 'SKIPPED', {
        reason: 'No existing recovery link to remind customer about.',
      });
      return rejectedResult(recoveryCaseId, approvedAction, 'No existing recovery link available for reminder.');
    }

    const recipientEmail = payment.customer?.email ?? null;
    if (!recipientEmail) {
      await prisma.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: {
          actionStatus: 'FAILED',
        },
      });

      await logAudit(recoveryCaseId, 'RECOVERY_REMINDER_FAILED', 'FAILED', {
        reason: 'Customer email missing from trusted payment record.',
        recoveryLinkUrl: recoveryCase.recoveryLinkUrl,
      });

      return {
        success: false,
        recoveryCaseId: recoveryCase.id,
        action: approvedAction,
        status: 'FAILED',
        error: 'Customer email missing from payment record.',
      };
    }

    const notificationResult = await notificationService.sendRecoveryReminder({
      recipientEmail,
      recoveryLinkUrl: recoveryCase.recoveryLinkUrl,
      paymentId: payment.id,
      revenueAtRisk: recoveryCase.revenueAtRisk,
    });

    if (notificationResult.success) {
      await prisma.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: {
          actionStatus: 'COMPLETED',
        },
      });

      await logAudit(recoveryCaseId, 'RECOVERY_REMINDER_SENT', 'COMPLETED', {
        provider: notificationResult.provider,
        messageId: notificationResult.messageId,
        recipientEmail,
        recoveryLinkUrl: recoveryCase.recoveryLinkUrl,
      });

      return {
        success: true,
        recoveryCaseId: recoveryCase.id,
        action: approvedAction,
        status: 'COMPLETED',
        message: 'Recovery reminder notification sent successfully.',
        revenueAtRisk: recoveryCase.revenueAtRisk,
      };
    } else {
      await prisma.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: {
          actionStatus: 'FAILED',
        },
      });

      await logAudit(recoveryCaseId, 'RECOVERY_REMINDER_FAILED', 'FAILED', {
        provider: notificationResult.provider,
        reason: notificationResult.error || 'Notification delivery failed.',
        recipientEmail,
        recoveryLinkUrl: recoveryCase.recoveryLinkUrl,
      });

      return {
        success: false,
        recoveryCaseId: recoveryCase.id,
        action: approvedAction,
        status: 'FAILED',
        error: notificationResult.error || 'Failed to send recovery reminder notification.',
      };
    }
  }

  // ── CREATE_PAYMENT_LINK execution ─────────────────────────────────────────
  // Only this action reaches Razorpay. Amount MUST come from the trusted
  // RecoveryCase, never from the LLM decision.

  // Atomic claim: transition NONE/PENDING/FAILED → IN_PROGRESS
  const claimResult = await prisma.recoveryCase.updateMany({
    where: {
      id: recoveryCaseId,
      actionStatus: { notIn: ['IN_PROGRESS', 'COMPLETED'] },
      recoveryLinkId: null,
    },
    data: { actionStatus: 'IN_PROGRESS' },
  });

  if (claimResult.count === 0) {
    // Another concurrent process may have claimed or completed it.
    const freshCase = await prisma.recoveryCase.findUnique({ where: { id: recoveryCaseId } });
    if (freshCase?.recoveryLinkId && freshCase?.recoveryLinkUrl) {
      return {
        success: true,
        recoveryCaseId: freshCase.id,
        action: approvedAction,
        status: 'COMPLETED',
        paymentLink: {
          id: freshCase.recoveryLinkId,
          url: freshCase.recoveryLinkUrl,
        },
        revenueAtRisk: freshCase.revenueAtRisk,
        message: 'Existing recovery payment link returned (idempotent concurrent claim).',
      };
    }
    await logAudit(recoveryCaseId, 'ACTION_BLOCKED', 'SKIPPED', {
      reason: 'Action already IN_PROGRESS or COMPLETED by a concurrent request.',
    });
    return rejectedResult(recoveryCaseId, approvedAction, 'Action is already in progress or completed.');
  }

  // Audit: execution requested and claimed
  await logAudit(recoveryCaseId, 'ACTION_REQUESTED', 'IN_PROGRESS', {
    action: approvedAction,
    policyReason: policyDecision.reason,
    revenueAtRisk: recoveryCase.revenueAtRisk,
    confidence: context.recovery.baselineRecoveryProbability,
  });

  // ── Razorpay Payment Link creation ───────────────────────────────────────
  // IMPORTANT: The amount is taken from the trusted RecoveryCase, NOT the LLM.
  // Customer details come from the verified payment record, NOT the LLM.
  try {
    const linkResult = await createPaymentLink({
      amount: recoveryCase.revenueAtRisk,
      description: `Revenue Recovery — Payment ${payment.razorpayPaymentId}`,
      referenceId: recoveryCase.id,
      // PII from payment record only — never from LLM output
      customerEmail: payment.customer?.email ?? null,
      customerContact: payment.customer?.contact ?? null,
      notes: {
        paymentId: payment.id,
        razorpayPaymentId: payment.razorpayPaymentId,
      },
    });

    // Persist success
    await prisma.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: {
        actionStatus: 'COMPLETED',
        recommendedAction: 'CREATE_PAYMENT_LINK',
        recoverabilityStatus: 'RECOVERABLE',
        recoveryAttemptCount: { increment: 1 },
        recoveryLinkId: linkResult.id,
        recoveryLinkUrl: linkResult.shortUrl,
      },
    });

    await logAudit(recoveryCaseId, 'PAYMENT_LINK_CREATED', 'COMPLETED', {
      paymentLinkId: linkResult.id,
      shortUrl: linkResult.shortUrl,
      status: linkResult.status,
      revenueAtRisk: recoveryCase.revenueAtRisk,
    });

    return {
      success: true,
      recoveryCaseId: recoveryCase.id,
      action: 'CREATE_PAYMENT_LINK',
      status: 'COMPLETED',
      paymentLink: {
        id: linkResult.id,
        url: linkResult.shortUrl,
      },
      revenueAtRisk: recoveryCase.revenueAtRisk,
      message: 'Recovery payment link created.',
    };

  } catch (error: any) {
    // NOTE: Residual failure mode — if Razorpay succeeded but the DB update
    // below fails, the next call will not find recoveryLinkId and could
    // attempt a second link creation. The Razorpay reference_id (=recoveryCaseId)
    // is idempotent on the Razorpay side but their API does not expose a
    // reliable fetch-by-reference_id endpoint in the current SDK version.
    // For MVP we document this limitation and rely on the atomic DB claim.
    const sanitizedError =
      error?.message || error?.description || 'Failed to create payment link via Razorpay API.';

    await prisma.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: {
        actionStatus: 'FAILED',
        recoveryAttemptCount: { increment: 1 },
      },
    });

    await logAudit(recoveryCaseId, 'ACTION_FAILED', 'FAILED', {
      error: sanitizedError,
      paymentId: payment.id,
    });

    return {
      success: false,
      recoveryCaseId: recoveryCase.id,
      action: 'CREATE_PAYMENT_LINK',
      status: 'FAILED',
      error: sanitizedError,
    };
  }
}
