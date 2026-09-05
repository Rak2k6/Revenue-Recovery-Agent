import { Application } from 'express';
import { webhookRouter } from './webhooks';
import { paymentsRouter } from './payments';
import { recoveryCasesRouter } from './recoveryCases';
import { frontendRouter } from './frontend';

/**
 * Mount all Milestone 1 routes onto the existing Express app.
 * Called from index.js after the app is created.
 *
 * NOTE: req.rawBody is populated by the express.json({ verify }) callback
 * registered in index.js BEFORE these routes are mounted.
 * The webhook handler reads req.rawBody for HMAC-SHA256 verification; it
 * does NOT attempt to re-read the already-consumed request stream.
 */
export function mountRoutes(app: Application): void {
  app.use(webhookRouter);
  app.use(paymentsRouter);
  app.use(recoveryCasesRouter);
  app.use(frontendRouter);
}
