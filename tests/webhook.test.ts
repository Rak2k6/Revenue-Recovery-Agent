import crypto from 'crypto';
import { classifyFailure } from '../src/classifiers/failureClassifier';
import { calculateRevenueAtRisk } from '../src/recovery/revenueRisk';
import { isRecoverable } from '../src/recovery/recoverabilityChecker';
import { normalizePaymentEvent } from '../src/integrations/razorpay/normalizer';
import { verifyWebhookSignature } from '../src/integrations/razorpay/verifier';

// Load real fixtures
const cancellationFixture = require('./fixtures/payment_failed_cancellation.json');
const bankDeclineFixture   = require('./fixtures/payment_failed_bank_decline.json');
const capturedFixture      = require('./fixtures/payment_captured.json');
const refundedFixture      = require('./fixtures/payment_refunded.json');

const TEST_SECRET = 'test_webhook_secret';

function makeSignature(body: object): string {
  return crypto.createHmac('sha256', TEST_SECRET).update(JSON.stringify(body)).digest('hex');
}

// ─── Normalizer ──────────────────────────────────────────────────────────────

describe('Normalizer', () => {
  it('normalizes a payment.failed cancellation', () => {
    const event = normalizePaymentEvent(cancellationFixture);
    expect(event.razorpayPaymentId).toBe('pay_TWNYAiJhT1wvzF');
    expect(event.status).toBe('FAILED');
    expect(event.captured).toBe(false);
    expect(event.error?.reason).toBe('payment_cancelled');
    expect(event.error?.source).toBe('customer');
    expect(event.razorpayCreatedAt).toBeInstanceOf(Date);
  });

  it('normalizes a payment.captured event', () => {
    const event = normalizePaymentEvent(capturedFixture);
    expect(event.status).toBe('CAPTURED');
    expect(event.captured).toBe(true);
    expect(event.error).toBeNull();
  });

  it('throws on missing payment entity', () => {
    expect(() => normalizePaymentEvent({ event: 'payment.failed', payload: {} } as never))
      .toThrow('Webhook payload missing payment entity');
  });
});

// ─── Failure Classifier ───────────────────────────────────────────────────────

describe('Failure Classifier', () => {
  it('classifies customer cancellation as CUSTOMER_ABANDONMENT', () => {
    const event = normalizePaymentEvent(cancellationFixture);
    expect(classifyFailure(event.error)).toBe('CUSTOMER_ABANDONMENT');
  });

  it('classifies bank decline as BANK_DECLINE', () => {
    const event = normalizePaymentEvent(bankDeclineFixture);
    expect(classifyFailure(event.error)).toBe('BANK_DECLINE');
  });

  it('returns UNKNOWN for null error', () => {
    expect(classifyFailure(null)).toBe('UNKNOWN');
  });
});

// ─── Recoverability ───────────────────────────────────────────────────────────

describe('Recoverability Checker', () => {
  it('CUSTOMER_ABANDONMENT is recoverable', () => {
    expect(isRecoverable('CUSTOMER_ABANDONMENT')).toBe(true);
  });

  it('BANK_DECLINE is recoverable', () => {
    expect(isRecoverable('BANK_DECLINE')).toBe(true);
  });

  it('RISK_REJECTION is NOT recoverable', () => {
    expect(isRecoverable('RISK_REJECTION')).toBe(false);
  });
});

// ─── Revenue At Risk ─────────────────────────────────────────────────────────

describe('Revenue At Risk', () => {
  it('calculates full amount for a failed payment', () => {
    const event = normalizePaymentEvent(cancellationFixture);
    expect(calculateRevenueAtRisk(event)).toBe(50000); // ₹500 in paise
  });

  it('returns 0 for a captured payment', () => {
    const event = normalizePaymentEvent(capturedFixture);
    expect(calculateRevenueAtRisk(event)).toBe(0);
  });

  it('returns 0 for a fully refunded payment', () => {
    const event = normalizePaymentEvent(refundedFixture);
    // status=refunded, not FAILED → 0
    expect(calculateRevenueAtRisk(event)).toBe(0);
  });
});

// ─── Signature Verification ───────────────────────────────────────────────────

describe('Webhook Signature Verification', () => {
  it('accepts a valid signature', () => {
    const body = cancellationFixture;
    const raw = Buffer.from(JSON.stringify(body));
    const sig = makeSignature(body);
    expect(verifyWebhookSignature(raw, sig, TEST_SECRET)).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const body = cancellationFixture;
    const raw = Buffer.from(JSON.stringify(body));
    expect(verifyWebhookSignature(raw, 'deadbeef', TEST_SECRET)).toBe(false);
  });

  it('rejects when body is modified after signing', () => {
    const body = cancellationFixture;
    const sig = makeSignature(body);
    const tamperedRaw = Buffer.from(JSON.stringify({ ...body, tampered: true }));
    expect(verifyWebhookSignature(tamperedRaw, sig, TEST_SECRET)).toBe(false);
  });
});
