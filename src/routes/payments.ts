import { Router, Request, Response } from 'express';
import { prisma } from '../db/prismaClient';

export const paymentsRouter = Router();

// Internal API key middleware
function requireInternalKey(req: Request, res: Response, next: () => void) {
  const key = req.headers['x-internal-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

/** GET /payments — list payments (paginated, filterable by status) */
paymentsRouter.get('/payments', requireInternalKey, async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const where = status ? { status: status.toUpperCase() as never } : {};

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: { customer: true, recoveryCase: true },
    }),
    prisma.payment.count({ where }),
  ]);

  res.json({ data, total, limit, offset });
});

/** GET /payments/:id — single payment with recovery case */
paymentsRouter.get('/payments/:id', requireInternalKey, async (req: Request, res: Response) => {
  const paymentId = req.params.id as string;
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { customer: true, recoveryCase: { include: { auditLogs: true } } },
  });

  if (!payment) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }

  res.json({ data: payment });
});
