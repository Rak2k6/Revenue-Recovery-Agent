import crypto from 'crypto';

/**
 * Verifies the Razorpay webhook HMAC-SHA256 signature.
 * Must be called against the RAW request body buffer — before JSON parsing.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');

    if (sigBuf.length !== expBuf.length) return false;

    return crypto.timingSafeEqual(expBuf, sigBuf);
  } catch {
    return false;
  }
}
