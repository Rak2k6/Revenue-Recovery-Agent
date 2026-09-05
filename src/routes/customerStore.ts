import { Router, Request, Response } from 'express';
import Razorpay from 'razorpay';
import { prisma } from '../db/prismaClient';
import { runRecoveryPipeline } from '../recovery/recoveryPipeline';

export const customerStoreRouter = Router();

function customerNotificationId(kind: string, paymentId: string): string {
  return `store-${kind}-${paymentId}`;
}

function buildCustomerNotifications(payment: any): Array<Record<string, unknown>> {
  const notifications: Array<Record<string, unknown>> = [];
  const paymentId = payment.id as string;
  const orderId = payment.razorpayOrderId as string | null;
  const amount = payment.amount as number;
  const recoveryCase = payment.recoveryCase;

  if (payment.status === 'FAILED') {
    notifications.push({
      id: customerNotificationId('failed', paymentId),
      type: 'PAYMENT_FAILURE',
      title: 'Payment unsuccessful',
      message: 'We could not complete your payment.',
      actionLabel: 'Try Again',
      actionUrl: orderId ? `/payment-status/${encodeURIComponent(orderId)}` : undefined,
      state: 'UNREAD',
      read: false,
      createdAt: payment.updatedAt,
      metadata: { orderId, amount, currency: payment.currency },
    });
  }

  if (recoveryCase?.recoveryLinkUrl && recoveryCase.recoverabilityStatus !== 'RECOVERED') {
    notifications.push({
      id: customerNotificationId('recovery', paymentId),
      type: 'PAYMENT_RECOVERY',
      title: 'Payment recovery available',
      message: 'A secure payment option is available to complete your order.',
      actionLabel: 'Complete Payment',
      actionUrl: recoveryCase.recoveryLinkUrl,
      recoveryLinkUrl: recoveryCase.recoveryLinkUrl,
      state: 'ACTION_REQUIRED',
      read: false,
      createdAt: recoveryCase.updatedAt,
      metadata: { orderId, amount: recoveryCase.revenueAtRisk, currency: payment.currency },
    });
  }

  if (payment.status === 'CAPTURED' || payment.captured || recoveryCase?.recoverabilityStatus === 'RECOVERED') {
    notifications.push({
      id: customerNotificationId('success', paymentId),
      type: 'ORDER_CONFIRMED',
      title: 'Payment successful',
      message: 'Your payment was successful and your order has been confirmed.',
      actionLabel: 'View Order',
      actionUrl: orderId ? `/orders/${encodeURIComponent(orderId)}` : undefined,
      state: 'COMPLETED',
      read: true,
      createdAt: payment.updatedAt,
      metadata: { orderId, amount, currency: payment.currency },
    });
  }

  return notifications;
}

function getRazorpayClient(): Razorpay {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
  });
}

function customerError(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

/** Customer-safe checkout adapter. Amount is supplied in rupees by the store. */
customerStoreRouter.post('/api/store/checkout', async (req: Request, res: Response) => {
  const amount = Number(req.body?.amount);
  const receipt = typeof req.body?.receipt === 'string' ? req.body.receipt : `store_${Date.now()}`;

  if (!Number.isFinite(amount) || amount <= 0) {
    return customerError(res, 400, 'A valid payment amount is required.');
  }

  try {
    const order = await getRazorpayClient().orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: receipt.slice(0, 40),
      notes: { customerEmail: String(req.body?.customerEmail || '').slice(0, 100) },
    });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || '',
    });
  } catch (error) {
    return customerError(res, 502, 'Unable to start payment. Please try again.');
  }
});

/** Customer-safe status view. Webhook state remains the source of truth. */
customerStoreRouter.get('/api/store/payments/:orderId/status', async (req: Request, res: Response) => {
  const orderId = req.params.orderId as string;

  try {
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: orderId },
      include: { recoveryCase: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!payment) {
      return res.json({ state: 'PROCESSING', message: 'We are confirming your payment.' });
    }

    if (payment.status === 'CAPTURED' || payment.captured) {
      return res.json({ state: 'PAID', orderId, message: 'Payment successful. Your order has been confirmed.' });
    }

    if (payment.status !== 'FAILED') {
      return res.json({ state: 'PROCESSING', message: 'We are confirming your payment.' });
    }

    const recoveryCase = payment.recoveryCase;
    if (!recoveryCase) {
      return res.json({ state: 'FAILED', orderId, message: 'Your payment could not be completed.' });
    }

    if (recoveryCase.recoverabilityStatus === 'RECOVERED') {
      return res.json({ state: 'PAID', orderId, message: 'Payment successful. Your order has been confirmed.' });
    }

    if (!recoveryCase.recoveryLinkUrl && recoveryCase.recoverabilityStatus === 'PENDING_ASSESSMENT') {
      try {
        await runRecoveryPipeline(recoveryCase.id);
      } catch {
        // The next status poll can retry the existing idempotent pipeline.
      }
    }

    const refreshedCase = await prisma.recoveryCase.findUnique({ where: { id: recoveryCase.id } });
    if (refreshedCase?.recoveryLinkUrl) {
      return res.json({
        state: 'RECOVERY_READY',
        orderId,
        paymentLinkUrl: refreshedCase.recoveryLinkUrl,
        message: 'A secure payment link is available to complete your payment.',
      });
    }

    return res.json({ state: 'RECOVERY_PROCESSING', orderId, message: 'Your payment could not be completed.' });
  } catch {
    return customerError(res, 500, 'Unable to retrieve payment status.');
  }
});

/** Customer-safe notification bridge derived from payment/recovery state. */
customerStoreRouter.get('/api/store/notifications', async (req: Request, res: Response) => {
  const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId.trim() : '';

  if (!email && !orderId) {
    return res.json({ notifications: [], unreadCount: 0, serverTime: new Date().toISOString() });
  }

  try {
    const payments = await prisma.payment.findMany({
      where: {
        OR: [
          ...(email ? [{ customer: { email } }] : []),
          ...(orderId ? [{ razorpayOrderId: orderId }] : []),
        ],
      },
      include: { recoveryCase: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    await Promise.all(
      payments
        .filter((payment) => payment.status === 'FAILED')
        .filter((payment) => payment.recoveryCase?.recoverabilityStatus === 'PENDING_ASSESSMENT')
        .map(async (payment) => {
          const recoveryCase = payment.recoveryCase;
          if (!recoveryCase) return;
          try {
            await runRecoveryPipeline(recoveryCase.id);
          } catch {
            // A later poll can retry the existing pipeline without changing its rules.
          }
        })
    );

    const refreshedPayments = await prisma.payment.findMany({
      where: {
        OR: [
          ...(email ? [{ customer: { email } }] : []),
          ...(orderId ? [{ razorpayOrderId: orderId }] : []),
        ],
      },
      include: { recoveryCase: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const notifications = refreshedPayments.flatMap(buildCustomerNotifications);
    return res.json({
      notifications,
      unreadCount: notifications.filter((notification) => notification.read === false).length,
      serverTime: new Date().toISOString(),
    });
  } catch {
    return customerError(res, 500, 'Unable to retrieve customer notifications.');
  }
});