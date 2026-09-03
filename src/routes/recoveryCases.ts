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

import { executeRecoveryAction } from '../recovery/actionExecutor';

/** POST /recovery-cases/:id/execute — execute approved recovery decision */
recoveryCasesRouter.post('/recovery-cases/:id/execute', requireInternalKey, async (req: Request, res: Response) => {
  const recoveryCaseId = req.params.id as string;
  const result = await executeRecoveryAction(recoveryCaseId);
  res.json(result);
});

/** GET /recovery-metrics — calculate recovery metrics */
recoveryCasesRouter.get('/recovery-metrics', requireInternalKey, async (req: Request, res: Response) => {
  const cases = await prisma.recoveryCase.findMany({
    include: { payment: true },
  });

  let totalRevenueAtRisk = 0;
  let totalRevenueRecovered = 0;

  for (const c of cases) {
    // Only count eligible revenue at risk (not NOT_RECOVERABLE or captured/refunded)
    if (c.recoverabilityStatus !== 'NOT_RECOVERABLE' && c.payment.status === 'FAILED') {
      totalRevenueAtRisk += c.revenueAtRisk;
    }
    if (c.recoverabilityStatus === 'RECOVERED') {
      totalRevenueRecovered += c.amountRecovered;
    }
  }

  const recoveryRate = totalRevenueAtRisk > 0 ? Number((totalRevenueRecovered / totalRevenueAtRisk).toFixed(4)) : 0;

  res.json({
    totalRevenueAtRisk,
    totalRevenueRecovered,
    recoveryRate,
  });
});

