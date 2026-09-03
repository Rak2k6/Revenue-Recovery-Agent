/**
 * tests/webhookHttp.test.ts
 *
 * HTTP-level integration tests for POST /webhooks/razorpay.
 *
 * Strategy:
 *   - Import createApp() (the Express app factory from src/app.ts) and wrap it
 *     in supertest — no port binding, no external I/O.
 *   - Mock processWebhookEvent so these tests never touch Prisma or the database.
 *   - Mock the logger to silence noise in test output.
 *   - Tests verify response codes, JSON shapes, and — critically — that the
 *     request does not hang (supertest has a built-in timeout enforced by Jest's
 *     testTimeout).
 */

import crypto from 'crypto';
import request from 'supertest';

// ─── Module mocks (must precede imports that use them) ────────────────────────

jest.mock('../src/services/webhookService', () => ({
  processWebhookEvent: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── Imports (after mocks are registered) ─────────────────────────────────────

import { createApp } from '../src/app';
import { processWebhookEvent } from '../src/services/webhookService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test_webhook_secret_http';

function sign(body: object | string): string {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return crypto.createHmac('sha256', TEST_SECRET).update(raw).digest('hex');
}

const minimalPayload = {
  event: 'payment.failed',
  payload: {
    payment: {
      entity: {
        id: 'pay_test123',
        amount: 50000,
        currency: 'INR',
        status: 'failed',
      },
    },
  },
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('POST /webhooks/razorpay — HTTP integration', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_SECRET;
    app = createApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Missing signature header ─────────────────────────────────────────────
  it('returns 400 immediately when x-razorpay-signature header is absent', async () => {
    const res = await request(app)
      .post('/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(minimalPayload));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Missing') });
    expect(processWebhookEvent).not.toHaveBeenCalled();
  });

  // ── 2. Invalid (tampered) signature ─────────────────────────────────────────
  it('returns 400 immediately for an invalid signature', async () => {
    const res = await request(app)
      .post('/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'deadbeef00000000')
      .send(JSON.stringify(minimalPayload));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid signature' });
    expect(processWebhookEvent).not.toHaveBeenCalled();
  });

  // ── 3. Empty body ({}) with missing signature ────────────────────────────────
  it('returns 400 promptly for empty payload without signature (no hang)', async () => {
    const res = await request(app)
      .post('/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Missing') });
  });

  // ── 4. Valid signature → processWebhookEvent called ────────────────────────
  it('returns 200 and calls processWebhookEvent for a valid signature', async () => {
    const mockResult = { skipped: false, eventId: 'ev_1', paymentId: 'pay_test123', recoveryCaseId: null };
    (processWebhookEvent as jest.Mock).mockResolvedValueOnce(mockResult);

    const bodyStr = JSON.stringify(minimalPayload);
    const sig = sign(minimalPayload);

    const res = await request(app)
      .post('/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(bodyStr);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, skipped: false, eventId: 'ev_1' });
    expect(processWebhookEvent).toHaveBeenCalledTimes(1);
  });

  // ── 5. Valid signature, duplicate webhook (idempotency) ─────────────────────
  it('returns 200 with skipped=true for a duplicate webhook', async () => {
    const mockResult = { skipped: true, eventId: 'pay_test123', paymentId: null, recoveryCaseId: null };
    (processWebhookEvent as jest.Mock).mockResolvedValueOnce(mockResult);

    const sig = sign(minimalPayload);

    const res = await request(app)
      .post('/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(JSON.stringify(minimalPayload));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, skipped: true });
  });

  // ── 6. Valid signature, internal processing error → 500 ─────────────────────
  it('returns 500 when processWebhookEvent throws (triggers Razorpay retry)', async () => {
    (processWebhookEvent as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const sig = sign(minimalPayload);

    const res = await request(app)
      .post('/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(JSON.stringify(minimalPayload));

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Internal processing error' });
  });

  // ── 7. HMAC is computed against exact raw bytes (not re-serialized JSON) ─────
  it('rejects if signature was computed against different serialization', async () => {
    // Sign a differently-formatted version of the same logical object
    const differentSerialization = JSON.stringify(minimalPayload, null, 2); // pretty-printed
    const sig = crypto.createHmac('sha256', TEST_SECRET)
      .update(differentSerialization)
      .digest('hex');

    // Send compact JSON — bytes differ, so HMAC should not match
    const res = await request(app)
      .post('/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(JSON.stringify(minimalPayload));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid signature' });
  });
});
