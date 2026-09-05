import { Router, Request, Response } from 'express';
import { prisma } from '../db/prismaClient';

export const recoveryCasesRouter = Router();

function requireInternalKey(req: Request, res: Response, next: () => void) {
  const key = req.headers['x-internal-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

/** GET /recovery-cases — list recovery cases (paginated, filterable by status) */
recoveryCasesRouter.get('/recovery-cases', requireInternalKey, async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const where = status ? { recoverabilityStatus: status.toUpperCase() as never } : {};

  const [data, total] = await Promise.all([
    prisma.recoveryCase.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: { payment: { include: { customer: true } } },
    }),
    prisma.recoveryCase.count({ where }),
  ]);

  res.json({ data, total, limit, offset });
});

import { getRecoveryMetrics } from '../recovery/recoveryMetrics';

/**
 * GET /recovery-cases/metrics
 *
 * Calculates aggregate recovery metrics directly from database records.
 * Registered BEFORE /recovery-cases/:id to avoid matching "metrics" as an ID.
 */
recoveryCasesRouter.get('/recovery-cases/metrics', requireInternalKey, async (req: Request, res: Response) => {
  try {
    const metrics = await getRecoveryMetrics();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error calculating recovery metrics.',
    });
  }
});

/** GET /recovery-cases/:id — single case with payment + full audit log */
recoveryCasesRouter.get('/recovery-cases/:id', requireInternalKey, async (req: Request, res: Response) => {
  const recoveryCaseId = req.params.id as string;
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: { id: recoveryCaseId },
    include: {
      payment: { include: { customer: true } },
      auditLogs: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!recoveryCase) {
    res.status(404).json({ error: 'Recovery case not found' });
    return;
  }

  res.json({ data: recoveryCase });
});

import { decideRecoveryAction } from '../recovery/decisionEngine';
import { validateRecoveryDecision } from '../recovery/policyGuardrail';

/** POST /recovery-cases/:id/assess — run decision engine on case */
recoveryCasesRouter.post('/recovery-cases/:id/assess', requireInternalKey, async (req: Request, res: Response) => {
  const recoveryCaseId = req.params.id as string;
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: { id: recoveryCaseId },
    include: { payment: true }
  });

  if (!recoveryCase || !recoveryCase.payment) {
    res.status(404).json({ error: 'Recovery case or payment not found' });
    return;
  }

  const payment = recoveryCase.payment;

  // Load customer history (all previous payments by this customer)
  let customerPayments: any[] = [];
  if (payment.customerId) {
    customerPayments = await prisma.payment.findMany({
      where: { customerId: payment.customerId }
    });
  }

  // Run Decision Engine
  const decision = decideRecoveryAction(recoveryCase as any, payment as any, customerPayments);

  // Run Policy Guardrail
  const guardrailResult = validateRecoveryDecision(decision, recoveryCase as any, payment as any);

  // Store the decision
  const updatedCase = await prisma.recoveryCase.update({
    where: { id: recoveryCase.id },
    data: {
      recoveryProbability: decision.recoveryProbability,
      priority: decision.priority,
      recommendedAction: decision.recommendedAction,
      preferredMethod: decision.preferredPaymentMethod,
      reasoning: decision.reason,
      confidence: decision.confidence,
      stopCondition: decision.stopCondition,
      maxRecoveryAttempts: decision.maxAttempts
    }
  });

  // Create an audit log
  await prisma.recoveryAuditLog.create({
    data: {
      recoveryCaseId: recoveryCase.id,
      action: 'ASSESSMENT_COMPLETED',
      status: guardrailResult.allowed ? 'COMPLETED' : 'SKIPPED',
      metadata: {
        decision: decision as any,
        policyBlocked: !guardrailResult.allowed,
        policyReason: guardrailResult.reason
      }
    }
  });

  res.json({
    recoveryCaseId: recoveryCase.id,
    revenueAtRisk: recoveryCase.revenueAtRisk,
    decision: decision,
    policyAllowed: guardrailResult.allowed,
    policyReason: guardrailResult.reason
  });
});

import { runRecoveryPipeline } from '../recovery/recoveryPipeline';
import { runRecoveryBatch, DEFAULT_BATCH_LIMIT } from '../jobs/recoveryBatchRunner';

/**
 * POST /recovery-cases/batch-run
 *
 * Runs the batch recovery pipeline over all eligible PENDING_ASSESSMENT cases.
 * Registered BEFORE /recovery-cases/:id/execute so Express does not match the
 * literal "batch-run" as an :id parameter.
 *
 * Request body (optional):
 *   { "limit": 10 }
 *
 * If no limit is supplied the runner uses DEFAULT_BATCH_LIMIT.
 */
recoveryCasesRouter.post('/recovery-cases/batch-run', requireInternalKey, async (req: Request, res: Response) => {
  const rawLimit = req.body?.limit;
  const limit = typeof rawLimit === 'number' && rawLimit > 0 ? rawLimit : DEFAULT_BATCH_LIMIT;

  try {
    const summary = await runRecoveryBatch({ limit });
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || 'Internal server error during batch recovery run.',
    });
  }
});

/**
 * POST /recovery-cases/:id/execute
 *
 * Runs the full Phase 2C→2D→2E→2F pipeline:
 *   RecoveryCase → RecoveryContext → LLM → PolicyDecision → Executor → Outcome
 *
 * Only an approved PolicyDecision may trigger a Razorpay call.
 */
recoveryCasesRouter.post('/recovery-cases/:id/execute', requireInternalKey, async (req: Request, res: Response) => {
  const recoveryCaseId = req.params.id as string;

  try {
    const { result, llmDecision, policyDecision } = await runRecoveryPipeline(recoveryCaseId);

    res.json({
      ...result,
      pipeline: {
        llmAction: llmDecision.recommended_action,
        llmConfidence: llmDecision.confidence,
        policyApproved: policyDecision.approved,
        policyAction: policyDecision.action,
        policyReason: policyDecision.reason,
        stopCondition: policyDecision.stopCondition,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      recoveryCaseId,
      error: err?.message || 'Internal server error during recovery execution.',
    });
  }
});

/** GET /recovery-metrics — calculate recovery metrics (backwards compatibility alias) */
recoveryCasesRouter.get('/recovery-metrics', requireInternalKey, async (req: Request, res: Response) => {
  try {
    const metrics = await getRecoveryMetrics();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error calculating recovery metrics.',
    });
  }
});


