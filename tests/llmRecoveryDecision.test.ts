import { decideWithLLM, DETERMINISTIC_STOP_FALLBACK } from '../src/recovery/llmAgent';
import { LLMRecoveryDecisionSchema } from '../src/recovery/schemas/llmRecoveryDecisionSchema';
import { RecoveryContext } from '../src/recovery/schemas/recoveryContextSchema';
import * as groqModule from '../src/integrations/groq/client';

// Mock groq-sdk client
jest.mock('../src/integrations/groq/client', () => {
  const original = jest.requireActual('../src/integrations/groq/client');
  return {
    ...original,
    getGroqClient: jest.fn(),
  };
});

describe('Phase 2D — Groq LLM Recovery Decision Agent', () => {
  let mockGroqCreate: jest.Mock;

  const validContext: RecoveryContext = {
    schemaVersion: 1,
    payment: {
      razorpayPaymentId: 'pay_123',
      razorpayOrderId: 'order_123',
      amount: 150000,
      currency: 'INR',
      method: 'card',
      bank: 'HDFC',
      wallet: null,
      status: 'FAILED',
      razorpayCreatedAt: '2026-09-03T12:00:00.000Z',
    },
    failure: {
      category: 'BANK_DECLINE',
      errorCode: 'BAD_REQUEST_ERROR',
      errorDescription: 'Bank authorization failed',
      errorSource: 'bank',
      errorStep: 'authorization',
      errorReason: 'payment_failed',
    },
    customer: {
      tenureDays: 45,
      totalSuccessfulPayments: 3,
      totalFailedPayments: 1,
      lifetimeValue: 450000,
      averageOrderValue: 150000,
      hasEmail: true,
      hasContact: true,
    },
    recovery: {
      recoveryAttemptCount: 0,
      maxRecoveryAttempts: 3,
      attemptsRemaining: 3,
      previousActionsThisCase: [],
      existingRecoveryLinkUrl: null,
      caseAgeMinutes: 30,
      revenueAtRisk: 150000,
      baselineRecoveryProbability: 0.48,
    },
    policy: {
      recoveryWindowRemainingMinutes: 1410,
      withinContactLimit: true,
      isHighValue: false,
    },
  };

  const validLLMResponse = {
    schemaVersion: 1,
    failure_class: 'BANK_DECLINE',
    recoverability: 'medium',
    confidence: 0.86,
    recovery_probability: 0.67,
    recommended_action: 'CREATE_PAYMENT_LINK',
    reason_codes: ['CUSTOMER_HISTORY', 'RECOVERABLE_FAILURE'],
    reasoning: 'Customer has strong payment history and failure is bank-side decline.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGroqCreate = jest.fn();
    (groqModule.getGroqClient as jest.Mock).mockReturnValue({
      chat: {
        completions: {
          create: mockGroqCreate,
        },
      },
    });
  });

  // ── Test 1: Valid decision ───────────────────────────────────────────────────
  it('1. Returns validated decision when Groq responds with valid structured JSON', async () => {
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(validLLMResponse) } }],
    });

    const result = await decideWithLLM(validContext);

    expect(result).toEqual(validLLMResponse);
    expect(() => LLMRecoveryDecisionSchema.parse(result)).not.toThrow();
  });

  // ── Test 2: Invalid action ───────────────────────────────────────────────────
  it('2. Rejects invalid action (e.g. CHARGE_CUSTOMER) and returns STOP fallback', async () => {
    const invalidActionResponse = {
      ...validLLMResponse,
      recommended_action: 'CHARGE_CUSTOMER',
    };
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(invalidActionResponse) } }],
    });

    const result = await decideWithLLM(validContext);

    expect(result).toEqual(DETERMINISTIC_STOP_FALLBACK);
    expect(result.recommended_action).toBe('STOP');
  });

  // ── Test 3: Invalid confidence ───────────────────────────────────────────────
  it('3. Rejects invalid confidence (> 1.0) and returns STOP fallback', async () => {
    const invalidConfidenceResponse = {
      ...validLLMResponse,
      confidence: 1.5,
    };
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(invalidConfidenceResponse) } }],
    });

    const result = await decideWithLLM(validContext);

    expect(result).toEqual(DETERMINISTIC_STOP_FALLBACK);
  });

  // ── Test 4: Invalid recovery probability ────────────────────────────────────
  it('4. Rejects invalid recovery probability (< 0.0) and returns STOP fallback', async () => {
    const invalidProbResponse = {
      ...validLLMResponse,
      recovery_probability: -0.2,
    };
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(invalidProbResponse) } }],
    });

    const result = await decideWithLLM(validContext);

    expect(result).toEqual(DETERMINISTIC_STOP_FALLBACK);
  });

  // ── Test 5: Missing required fields ─────────────────────────────────────────
  it('5. Rejects missing required fields and returns STOP fallback', async () => {
    const missingFieldsResponse = {
      schemaVersion: 1,
      recommended_action: 'CREATE_PAYMENT_LINK',
    };
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(missingFieldsResponse) } }],
    });

    const result = await decideWithLLM(validContext);

    expect(result).toEqual(DETERMINISTIC_STOP_FALLBACK);
  });

  // ── Test 6: Closed enum & reason codes limit ───────────────────────────────
  it('6. Enforces closed enum reason codes and array length limits (1 to 5)', async () => {
    // 6a. Invalid reason code string
    const invalidReasonCode = {
      ...validLLMResponse,
      reason_codes: ['RANDOM_CUSTOM_TEXT'],
    };
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(invalidReasonCode) } }],
    });
    let result = await decideWithLLM(validContext);
    expect(result).toEqual(DETERMINISTIC_STOP_FALLBACK);

    // 6b. Empty reason codes array
    const emptyReasonCodes = {
      ...validLLMResponse,
      reason_codes: [],
    };
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(emptyReasonCodes) } }],
    });
    result = await decideWithLLM(validContext);
    expect(result).toEqual(DETERMINISTIC_STOP_FALLBACK);

    // 6c. Excess reason codes (> 5)
    const excessReasonCodes = {
      ...validLLMResponse,
      reason_codes: [
        'CUSTOMER_HISTORY',
        'RECOVERABLE_FAILURE',
        'LOW_HISTORY',
        'HIGH_VALUE',
        'REPEATED_FAILURE',
        'WINDOW_EXPIRING',
      ],
    };
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(excessReasonCodes) } }],
    });
    result = await decideWithLLM(validContext);
    expect(result).toEqual(DETERMINISTIC_STOP_FALLBACK);
  });

  // ── Test 7: Groq API failure ────────────────────────────────────────────────
  it('7. Handles Groq API failure gracefully and returns STOP fallback', async () => {
    mockGroqCreate.mockRejectedValueOnce(new Error('Groq rate limit exceeded'));

    const result = await decideWithLLM(validContext);

    expect(result).toEqual(DETERMINISTIC_STOP_FALLBACK);
    expect(result.recommended_action).toBe('STOP');
    expect(result.confidence).toBe(0);
    expect(result.recovery_probability).toBe(0);
  });

  // ── Test 8: Malformed model response ─────────────────────────────────────────
  it('8. Handles malformed non-JSON response from Groq and returns STOP fallback', async () => {
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Sorry, I cannot answer in JSON.' } }],
    });

    const result = await decideWithLLM(validContext);

    expect(result).toEqual(DETERMINISTIC_STOP_FALLBACK);
  });

  // ── Test 9: PII safety verification ─────────────────────────────────────────
  it('9. Verifies that payload passed to Groq contains zero raw customer email, phone, or card info', async () => {
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(validLLMResponse) } }],
    });

    await decideWithLLM(validContext);

    expect(mockGroqCreate).toHaveBeenCalledTimes(1);
    const sentUserMessage = mockGroqCreate.mock.calls[0][0].messages.find(
      (m: any) => m.role === 'user'
    ).content;

    expect(sentUserMessage).not.toContain('email');
    expect(sentUserMessage).not.toContain('contact');
    expect(sentUserMessage).toContain('"hasEmail":true');
    expect(sentUserMessage).toContain('"hasContact":true');
  });

  // ── Test 10: Existing deterministic probability behavior ────────────────────
  it('10. Ensures LLM decision does not modify the baseline probability inside RecoveryContext', async () => {
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(validLLMResponse) } }],
    });

    const originalBaselineProb = validContext.recovery.baselineRecoveryProbability;
    const llmDecision = await decideWithLLM(validContext);

    // Context baseline probability remains unchanged
    expect(validContext.recovery.baselineRecoveryProbability).toBe(originalBaselineProb);
    // LLM decision probability is separate
    expect(llmDecision.recovery_probability).toBe(0.67);
  });
});
