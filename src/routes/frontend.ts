import { Router, Request, Response } from 'express';
import { prisma } from '../db/prismaClient';
import { getRecoveryMetrics } from '../recovery/recoveryMetrics';
import { runRecoveryBatch } from '../jobs/recoveryBatchRunner';
import { runRecoveryPipeline } from '../recovery/recoveryPipeline';

export const frontendRouter = Router();

function parseLimit(req: Request): number {
  const value = Number(req.query.limit ?? 20);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 100) : 20;
}

function parseOffset(req: Request): number {
  const value = Number(req.query.offset ?? 0);
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

frontendRouter.get('/api/recovery-cases/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await getRecoveryMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Unable to load recovery metrics.' });
  }
});

frontendRouter.get('/api/recovery-metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await getRecoveryMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Unable to load recovery metrics.' });
  }
});

frontendRouter.get('/api/recovery-cases', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit = parseLimit(req);
  const offset = parseOffset(req);

  const where = status ? { recoverabilityStatus: status.toUpperCase() as never } : {};

  try {
    const [data, total] = await Promise.all([
      prisma.recoveryCase.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: { payment: { include: { customer: true } }, auditLogs: { orderBy: { createdAt: 'desc' } } },
      }),
      prisma.recoveryCase.count({ where }),
    ]);

    res.json({ data, total, limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Unable to load recovery cases.' });
  }
});

frontendRouter.get('/api/recovery-cases/:id', async (req: Request, res: Response) => {
  const recoveryCaseId = req.params.id as string;

  try {
    const recoveryCase = await prisma.recoveryCase.findUnique({
      where: { id: recoveryCaseId },
      include: {
        payment: { include: { customer: true } },
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!recoveryCase) {
      res.status(404).json({ error: 'Recovery case not found' });
      return;
    }

    res.json({ data: recoveryCase });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Unable to load recovery case details.' });
  }
});

frontendRouter.post('/api/recovery-cases/:id/execute', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      recoveryCaseId,
      error: error?.message || 'Internal server error during recovery execution.',
    });
  }
});

frontendRouter.post('/api/recovery-cases/batch-run', async (req: Request, res: Response) => {
  const rawLimit = req.body?.limit;
  const limit = typeof rawLimit === 'number' && rawLimit > 0 ? rawLimit : 25;

  try {
    const summary = await runRecoveryBatch({ limit });
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Internal server error during batch recovery run.' });
  }
});
