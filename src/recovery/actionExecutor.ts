import { prisma } from '../db/prismaClient';
import { decideRecoveryAction } from './decisionEngine';
import { validateRecoveryDecision } from './policyGuardrail';
import { createPaymentLink } from '../integrations/razorpay/paymentLink';

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

export async function executeRecoveryAction(
  recoveryCaseId: string
): Promise<ExecutionResult> {
  // 1. Load RecoveryCase with payment and customer
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: { id: recoveryCaseId },
    include: { payment: { include: { customer: true } } },
  });

  if (!recoveryCase || !recoveryCase.payment) {
    return {
      success: false,
      recoveryCaseId,
      action: 'NONE',
      status: 'FAILED',
      error: 'RecoveryCase or Payment not found.',
    };
  }

  const payment = recoveryCase.payment;

  // 2. Check Idempotency: If a link already exists, return existing link without re-creating
  if (recoveryCase.recoveryLinkId && recoveryCase.recoveryLinkUrl) {
    await prisma.recoveryAuditLog.create({
      data: {
        recoveryCaseId: recoveryCase.id,
        action: 'ACTION_ALREADY_EXISTS',
        status: 'COMPLETED',
        metadata: {
          recoveryLinkId: recoveryCase.recoveryLinkId,
          recoveryLinkUrl: recoveryCase.recoveryLinkUrl,
          message: 'Payment link already created previously.',
        },
      },
    });

    return {
      success: true,
      recoveryCaseId: recoveryCase.id,
      action: 'CREATE_PAYMENT_LINK',
      status: 'COMPLETED',
      paymentLink: {
        id: recoveryCase.recoveryLinkId,
        url: recoveryCase.recoveryLinkUrl,
      },
      revenueAtRisk: recoveryCase.revenueAtRisk,
      message: 'Existing recovery payment link returned (idempotent).',
    };
  }

  // 3. Perform pre-execution validations
  if (payment.status !== 'FAILED') {
    await logBlocked(recoveryCase.id, 'Payment status is not FAILED.');
    return blockResult(recoveryCase.id, 'Payment is not in FAILED state.');
  }

  if (recoveryCase.recoverabilityStatus !== 'RECOVERABLE' && recoveryCase.recoverabilityStatus !== 'PENDING_ASSESSMENT') {
    await logBlocked(recoveryCase.id, 'RecoveryCase is not recoverable.');
    return blockResult(recoveryCase.id, 'Case is not marked recoverable.');
  }

  if (recoveryCase.revenueAtRisk <= 0) {
    await logBlocked(recoveryCase.id, 'Revenue at risk is 0 or less.');
    return blockResult(recoveryCase.id, 'No revenue at risk.');
  }

  if (recoveryCase.recoveryAttemptCount >= recoveryCase.maxRecoveryAttempts) {
    await logBlocked(recoveryCase.id, `Max recovery attempts (${recoveryCase.maxRecoveryAttempts}) reached.`);
    return blockResult(recoveryCase.id, 'Max recovery attempts exceeded.');
  }

  // Retrieve customer history to get decision
  let customerPayments: any[] = [];
  if (payment.customerId) {
    customerPayments = await prisma.payment.findMany({
      where: { customerId: payment.customerId },
    });
  }

  const decision = decideRecoveryAction(recoveryCase, payment, customerPayments);

  if (decision.recommendedAction !== 'CREATE_PAYMENT_LINK') {
    await logBlocked(recoveryCase.id, `Recommended action '${decision.recommendedAction}' is not supported for execution.`);
    return blockResult(recoveryCase.id, `Unsupported or non-executable action: ${decision.recommendedAction}`);
  }

  // Run policy guardrail validation immediately before execution
  const guardrail = validateRecoveryDecision(decision, recoveryCase, payment);
  if (!guardrail.allowed) {
    await logBlocked(recoveryCase.id, guardrail.reason || 'Policy guardrail failed.');
    return blockResult(recoveryCase.id, guardrail.reason || 'Blocked by policy guardrail.');
  }

  // 4. Atomic Lock / Claim Mechanism for Concurrency Control
  const claimResult = await prisma.recoveryCase.updateMany({
    where: {
      id: recoveryCase.id,
      actionStatus: { notIn: ['IN_PROGRESS', 'COMPLETED'] },
      recoveryLinkId: null,
    },
    data: {
      actionStatus: 'IN_PROGRESS',
    },
  });

  if (claimResult.count === 0) {
    // Re-check if another concurrent request completed it or is in progress
    const freshCase = await prisma.recoveryCase.findUnique({ where: { id: recoveryCase.id } });
    if (freshCase?.recoveryLinkId && freshCase?.recoveryLinkUrl) {
      return {
        success: true,
        recoveryCaseId: freshCase.id,
        action: 'CREATE_PAYMENT_LINK',
        status: 'COMPLETED',
        paymentLink: {
          id: freshCase.recoveryLinkId,
          url: freshCase.recoveryLinkUrl,
        },
        revenueAtRisk: freshCase.revenueAtRisk,
        message: 'Existing recovery payment link returned (idempotent concurrent claim).',
      };
    }
    await logBlocked(recoveryCase.id, 'Action already IN_PROGRESS or COMPLETED by concurrent request.');
    return blockResult(recoveryCase.id, 'Action is already in progress or completed.');
  }

  // Audit ACTION_REQUESTED
  await prisma.recoveryAuditLog.create({
    data: {
      recoveryCaseId: recoveryCase.id,
      action: 'ACTION_REQUESTED',
      status: 'IN_PROGRESS',
      metadata: { action: 'CREATE_PAYMENT_LINK' },
    },
  });

  // 5. Call Razorpay API to create Payment Link
  try {
    const linkResult = await createPaymentLink({
      amount: recoveryCase.revenueAtRisk,
      description: `Revenue Recovery for Payment ${payment.razorpayPaymentId}`,
      referenceId: recoveryCase.id,
      customerEmail: payment.customer?.email,
      customerContact: payment.customer?.contact,
      notes: {
        paymentId: payment.id,
        razorpayPaymentId: payment.razorpayPaymentId,
      },
    });

    // 6. Update RecoveryCase status upon success
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

    // Audit PAYMENT_LINK_CREATED
    await prisma.recoveryAuditLog.create({
      data: {
        recoveryCaseId: recoveryCase.id,
        action: 'PAYMENT_LINK_CREATED',
        status: 'COMPLETED',
        metadata: {
          paymentLinkId: linkResult.id,
          shortUrl: linkResult.shortUrl,
          status: linkResult.status,
        },
      },
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
    const sanitizedError = error?.message || error?.description || 'Failed to create payment link via Razorpay API.';
    
    // Update RecoveryCase status to FAILED and increment attempt count
    await prisma.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: {
        actionStatus: 'FAILED',
        recoveryAttemptCount: { increment: 1 },
      },
    });

    // Audit ACTION_FAILED
    await prisma.recoveryAuditLog.create({
      data: {
        recoveryCaseId: recoveryCase.id,
        action: 'ACTION_FAILED',
        status: 'FAILED',
        metadata: {
          error: sanitizedError,
        },
      },
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

async function logBlocked(recoveryCaseId: string, reason: string) {
  await prisma.recoveryAuditLog.create({
    data: {
      recoveryCaseId,
      action: 'ACTION_BLOCKED',
      status: 'SKIPPED',
      metadata: { reason },
    },
  });
}

function blockResult(recoveryCaseId: string, reason: string): ExecutionResult {
  return {
    success: false,
    recoveryCaseId,
    action: 'CREATE_PAYMENT_LINK',
    status: 'SKIPPED',
    error: `Execution blocked: ${reason}`,
  };
}
