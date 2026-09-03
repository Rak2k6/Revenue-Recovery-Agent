import { Router, Request, Response } from 'express';
import { verifyWebhookSignature } from '../integrations/razorpay/verifier';
import { processWebhookEvent } from '../services/webhookService';
import { RazorpayWebhookPayload } from '../integrations/razorpay/types';
import { logger } from '../utils/logger';

export const webhookRouter = Router();

/**
 * POST /webhooks/razorpay
 *
 * req.rawBody is populated by the express.json({ verify }) callback in index.js.
 * The verify callback fires synchronously while the stream is consumed, so
 * req.rawBody contains the exact bytes Razorpay signed — before JSON parsing.
 *
 * Response matrix:
 *   400 → invalid/missing signature or missing webhook secret
 *   200 → valid + processed
 *   200 → valid + duplicate (skipped=true)
 *   200 → valid + unknown event type
 *   500 → valid + internal failure (triggers Razorpay retry)
 */
webhookRouter.post(
  '/webhooks/razorpay',
  async (req: Request, res: Response) => {
    const receivedAt = new Date();
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // ── Signature verification ─────────────────────────────────────────────
    if (!signature || !secret || !req.rawBody) {
      return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }

    if (!verifyWebhookSignature(req.rawBody, signature, secret)) {
      logger.warn({ signature: '[REDACTED]' }, 'Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // ── Parse JSON ────────────────────────────────────────────────────────
    let body: RazorpayWebhookPayload;
    try {
      body = JSON.parse(req.rawBody.toString('utf8')) as RazorpayWebhookPayload;
    } catch {
      // Malformed JSON from a verified source — 500 to allow Razorpay retry
      logger.error({}, 'Failed to parse verified webhook body as JSON');
      return res.status(500).json({ error: 'Malformed payload' });
    }

    // ── Process ────────────────────────────────────────────────────────────
    try {
      const result = await processWebhookEvent(body, receivedAt);
      return res.status(200).json({ received: true, ...result });
    } catch (err) {
      logger.error(
        { eventType: body.event, error: (err as Error).message },
        'Webhook processing failed'
      );
      // Return 500 so Razorpay retries — do NOT swallow internal errors as 200
      return res.status(500).json({ error: 'Internal processing error' });
    }
  }
);
