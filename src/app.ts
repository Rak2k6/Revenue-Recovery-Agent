import express from 'express';
import cors from 'cors';
import path from 'path';
import { mountRoutes } from './routes/index';

/**
 * Creates and returns the configured Express application.
 *
 * Separated from the server start (app.listen) so the app can be imported
 * by integration tests via supertest without binding to a port.
 *
 * IMPORTANT: The express.json({ verify }) callback captures the raw request
 * buffer into req.rawBody before JSON parsing completes. The webhook route
 * reads req.rawBody for HMAC-SHA256 signature verification.
 */
export function createApp(): express.Application {
  const app = express();

  app.use(cors());
  // Raw-body capture: the verify callback fires synchronously while the stream
  // is consumed by express.json, stashing the exact bytes on req.rawBody so
  // the webhook handler can verify the Razorpay HMAC without re-reading the stream.
  app.use(express.json({
    verify: (_req, _res, buf) => {
      (_req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  mountRoutes(app);

  return app;
}
