import { evaluateRecoveryPolicy, LLM_MIN_CONFIDENCE } from '../src/recovery/policyEngine';
import { RecoveryContext } from '../src/recovery/schemas/recoveryContextSchema';
import { LLMRecoveryDecision } from '../src/recovery/schemas/llmRecoveryDecisionSchema';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<{
  failureCategory: string;
  attemptsRemaining: number;
  recoveryWindowRemainingMinutes: number;
  withinContactLimit: boolean;
  hasEmail: boolean;
  hasContact: boolean;
  existingRecoveryLinkUrl: string | null;
  isHighValue: boolean;
  baselineRecoveryProbability: number;
  recoveryAttemptCount: number;
  previousActionsThisCase: { action: string; result: string }[];
}>): RecoveryContext {
  const f = {
    failureCategory: 'BANK_DECLINE',
    attemptsRemaining: 3,
    recoveryWindowRemainingMinutes: 1200,
    withinContactLimit: true,
    hasEmail: true,
    hasContact: true,
    existingRecoveryLinkUrl: null,
    isHighValue: false,
    baselineRecoveryProbability: 0.48,
    recoveryAttemptCount: 0,
    previousActionsThisCase: [],
    ...overrides,
  };

  return {
    schemaVersion: 1,
    payment: {
      razorpayPaymentId: 'pay_test001',
      razorpayOrderId: 'order_test001',
      amount: 150000,
      currency: 'INR',
      method: 'card',
      bank: 'HDFC',
      wallet: null,
      status: 'FAILED',
      razorpayCreatedAt: new Date().toISOString(),
    },
    failure: {
      category: f.failureCategory as any,
      errorCode: null,
      errorDescription: null,
      errorSource: null,
      errorStep: null,
      errorReason: null,
    },
    customer: {
      tenureDays: 45,
      totalSuccessfulPayments: 3,
      totalFailedPayments: 1,
      lifetimeValue: 450000,
      averageOrderValue: 150000,
      hasEmail: f.hasEmail,
      hasContact: f.hasContact,
    },
    recovery: {
      recoveryAttemptCount: f.recoveryAttemptCount,
      maxRecoveryAttempts: 3,
      attemptsRemaining: f.attemptsRemaining,
      previousActionsThisCase: f.previousActionsThisCase,
      existingRecoveryLinkUrl: f.existingRecoveryLinkUrl,
      caseAgeMinutes: 30,
      revenueAtRisk: 150000,
      baselineRecoveryProbability: f.baselineRecoveryProbability,
    },
    policy: {
      recoveryWindowRemainingMinutes: f.recoveryWindowRemainingMinutes,
      withinContactLimit: f.withinContactLimit,
      isHighValue: f.isHighValue,
    },
  };
}

function makeLLMDecision(overrides: Partial<LLMRecoveryDecision>): LLMRecoveryDecision {
  return {
    schemaVersion: 1,
    failure_class: 'BANK_DECLINE',
    recoverability: 'medium',
    confidence: 0.78,
    recovery_probability: 0.55,
    recommended_action: 'CREATE_PAYMENT_LINK',
    reason_codes: ['CUSTOMER_HISTORY', 'RECOVERABLE_FAILURE'],
    reasoning: 'Customer has payment history; bank decline is recoverable.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 2E — Deterministic Policy Engine', () => {

  // Test 1 —— Valid payment-link recommendation is approved
  it('1. Approves CREATE_PAYMENT_LINK when all conditions are satisfied', () => {
    const context = makeContext({});
    const decision = makeLLMDecision({ recommended_action: 'CREATE_PAYMENT_LINK', confidence: 0.78 });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.schemaVersion).toBe(1);
    expect(result.approved).toBe(true);
    expect(result.action).toBe('CREATE_PAYMENT_LINK');
    expect(result.stopCondition).toBeNull();
  });

  // Test 2 —— RISK_REJECTION overrides CREATE_PAYMENT_LINK
  it('2. RISK_REJECTION overrides CREATE_PAYMENT_LINK regardless of confidence', () => {
    const context = makeContext({ failureCategory: 'RISK_REJECTION' });
    const decision = makeLLMDecision({ confidence: 0.99, recommended_action: 'CREATE_PAYMENT_LINK' });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('STOP');
    expect(result.stopCondition).toBe('RISK_REJECTED');
  });

  // Test 3 —— Expired recovery window produces STOP
  it('3. Expired recovery window produces STOP with RECOVERY_WINDOW_EXPIRED', () => {
    const context = makeContext({ recoveryWindowRemainingMinutes: 0 });
    const decision = makeLLMDecision({ recommended_action: 'CREATE_PAYMENT_LINK', confidence: 0.90 });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('STOP');
    expect(result.stopCondition).toBe('RECOVERY_WINDOW_EXPIRED');
  });

  // Test 4 —— Attempts exhausted produces STOP
  it('4. Attempts exhausted produces STOP with POLICY_LIMIT_REACHED', () => {
    const context = makeContext({ attemptsRemaining: 0 });
    const decision = makeLLMDecision({ recommended_action: 'CREATE_PAYMENT_LINK', confidence: 0.85 });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('STOP');
    expect(result.stopCondition).toBe('POLICY_LIMIT_REACHED');
  });

  // Test 5 —— Low confidence produces STOP
  it('5. Low confidence produces STOP with LOW_CONFIDENCE', () => {
    const context = makeContext({});
    const decision = makeLLMDecision({ confidence: 0.42, recommended_action: 'CREATE_PAYMENT_LINK' });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('STOP');
    expect(result.stopCondition).toBe('LOW_CONFIDENCE');
  });

  // Test 6 —— LLM STOP remains STOP
  it('6. LLM-recommended STOP remains STOP', () => {
    const context = makeContext({});
    const decision = makeLLMDecision({
      recommended_action: 'STOP',
      confidence: 0.80,
      reason_codes: ['NOT_RECOVERABLE' as any],
    });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('STOP');
    expect(result.stopCondition).toBe('NOT_RECOVERABLE');
  });

  // Test 6b — LLM STOP with LOW_CONFIDENCE reason code maps correctly
  it('6b. LLM STOP with LOW_CONFIDENCE reason code maps stopCondition to LOW_CONFIDENCE', () => {
    const context = makeContext({});
    const decision = makeLLMDecision({
      recommended_action: 'STOP',
      confidence: 0.30,
      reason_codes: ['LOW_CONFIDENCE'],
    });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('STOP');
    expect(result.stopCondition).toBe('LOW_CONFIDENCE');
  });

  // Test 7 —— LLM NO_ACTION remains NO_ACTION (not a policy violation)
  it('7. LLM NO_ACTION remains NO_ACTION with approved=false and null stopCondition', () => {
    const context = makeContext({});
    const decision = makeLLMDecision({ recommended_action: 'NO_ACTION', confidence: 0.75 });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('NO_ACTION');
    expect(result.stopCondition).toBeNull();
  });

  // Test 8 —— CREATE_PAYMENT_LINK with no contact channel is rejected
  it('8. CREATE_PAYMENT_LINK is rejected when no customer contact channel is available', () => {
    const context = makeContext({ hasEmail: false, hasContact: false });
    const decision = makeLLMDecision({ recommended_action: 'CREATE_PAYMENT_LINK', confidence: 0.80 });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('STOP');
    expect(result.stopCondition).toBe('POLICY_LIMIT_REACHED');
    expect(result.reason).toMatch(/contact channel/i);
  });

  // Test 9 —— SEND_RECOVERY_REMINDER without existing recovery opportunity is rejected
  it('9. SEND_RECOVERY_REMINDER without existing recovery link is rejected', () => {
    const context = makeContext({ existingRecoveryLinkUrl: null });
    const decision = makeLLMDecision({ recommended_action: 'SEND_RECOVERY_REMINDER', confidence: 0.75 });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('STOP');
    expect(result.stopCondition).toBe('NOT_RECOVERABLE');
  });

  // Test 10 —— SEND_RECOVERY_REMINDER with valid existing recovery link is approved
  it('10. SEND_RECOVERY_REMINDER is approved when existing recovery link is present', () => {
    const context = makeContext({ existingRecoveryLinkUrl: 'https://rzp.io/l/testlink' });
    const decision = makeLLMDecision({ recommended_action: 'SEND_RECOVERY_REMINDER', confidence: 0.75 });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(true);
    expect(result.action).toBe('SEND_RECOVERY_REMINDER');
    expect(result.stopCondition).toBeNull();
  });

  // Test 11 —— CREATE_PAYMENT_LINK with existing recovery link → NO_ACTION (idempotency)
  it('11. CREATE_PAYMENT_LINK with existing recovery link converts to NO_ACTION (idempotency guard)', () => {
    const context = makeContext({ existingRecoveryLinkUrl: 'https://rzp.io/l/testlink' });
    const decision = makeLLMDecision({ recommended_action: 'CREATE_PAYMENT_LINK', confidence: 0.80 });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('NO_ACTION');
    expect(result.stopCondition).toBeNull();
    expect(result.reason).toMatch(/existing recovery link/i);
  });

  // Test 12 —— High-value status does not bypass policy restrictions
  it('12. High-value status does not bypass confidence restriction', () => {
    const context = makeContext({ isHighValue: true });
    const decision = makeLLMDecision({ confidence: 0.35, recommended_action: 'CREATE_PAYMENT_LINK' });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('STOP');
    expect(result.stopCondition).toBe('LOW_CONFIDENCE');
  });

  it('12b. High-value status does not bypass RISK_REJECTION rule', () => {
    const context = makeContext({ failureCategory: 'RISK_REJECTION', isHighValue: true });
    const decision = makeLLMDecision({ confidence: 0.99, recommended_action: 'CREATE_PAYMENT_LINK' });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('STOP');
    expect(result.stopCondition).toBe('RISK_REJECTED');
  });

  // Test 13 —— LLM recovery_probability does not influence authorization
  it('13. LLM recovery_probability=0.99 does not authorize when confidence is too low', () => {
    const context = makeContext({});
    const decision = makeLLMDecision({
      confidence: 0.25,
      recovery_probability: 0.99,
      recommended_action: 'CREATE_PAYMENT_LINK',
    });
    const result = evaluateRecoveryPolicy(context, decision);

    // Should be blocked by confidence, not authorized by high recovery_probability
    expect(result.approved).toBe(false);
    expect(result.stopCondition).toBe('LOW_CONFIDENCE');
  });

  // Test 14 —— Baseline recovery probability remains unchanged by policy evaluation
  it('14. Baseline recovery probability in context is not mutated by evaluateRecoveryPolicy', () => {
    const context = makeContext({ baselineRecoveryProbability: 0.48 });
    const decision = makeLLMDecision({ recommended_action: 'CREATE_PAYMENT_LINK', confidence: 0.78 });
    evaluateRecoveryPolicy(context, decision);

    // Verify context is untouched
    expect(context.recovery.baselineRecoveryProbability).toBe(0.48);
  });

  // Test 15 —— Policy Engine is side-effect free (no DB/network calls)
  it('15. evaluateRecoveryPolicy returns synchronously and has no async signature', () => {
    const context = makeContext({});
    const decision = makeLLMDecision({});
    const result = evaluateRecoveryPolicy(context, decision);

    // If it were async it would return a Promise; just verify it's a plain object
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.approved).toBe('boolean');
  });

  // Test 16 —— Unknown/invalid action safely produces STOP via defensive fallback
  it('16. Unexpected action value safely falls through to default STOP', () => {
    const context = makeContext({});
    // Cast an invalid action string through as any to test defensive fallback
    const decision = makeLLMDecision({ recommended_action: 'CHARGE_CUSTOMER' as any });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(false);
    expect(result.action).toBe('STOP');
  });

  // Test 17 —— Multiple violations use deterministic precedence: RISK_REJECTION wins
  it('17. RISK_REJECTION takes precedence over exhausted attempts and low confidence', () => {
    const context = makeContext({
      failureCategory: 'RISK_REJECTION',
      attemptsRemaining: 0,
    });
    const decision = makeLLMDecision({ confidence: 0.20, recommended_action: 'CREATE_PAYMENT_LINK' });
    const result = evaluateRecoveryPolicy(context, decision);

    // Rule 1 (RISK_REJECTION) fires before Rule 3 (attempts) and Rule 6 (confidence)
    expect(result.approved).toBe(false);
    expect(result.action).toBe('STOP');
    expect(result.stopCondition).toBe('RISK_REJECTED');
  });

  // Representative Example A — BANK_DECLINE, experienced customer → APPROVED
  it('Example A: BANK_DECLINE + experienced customer + valid LLM → APPROVED CREATE_PAYMENT_LINK', () => {
    const context = makeContext({
      failureCategory: 'BANK_DECLINE',
      attemptsRemaining: 3,
      recoveryWindowRemainingMinutes: 1200,
      withinContactLimit: true,
      hasEmail: true,
      hasContact: true,
      existingRecoveryLinkUrl: null,
      baselineRecoveryProbability: 0.48,
    });
    // LLM output matching prior live test
    const decision = makeLLMDecision({
      failure_class: 'BANK_DECLINE',
      recoverability: 'medium',
      confidence: 0.78,
      recovery_probability: 0.55,
      recommended_action: 'CREATE_PAYMENT_LINK',
      reason_codes: ['CUSTOMER_HISTORY', 'RECOVERABLE_FAILURE'],
    });
    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(true);
    expect(result.action).toBe('CREATE_PAYMENT_LINK');
    expect(result.stopCondition).toBeNull();
  });

  // Representative Example B — CUSTOMER_ABANDONMENT, new customer → APPROVED
  it('Example B: CUSTOMER_ABANDONMENT + new customer + email + high LLM confidence → APPROVED CREATE_PAYMENT_LINK', () => {
    const context: RecoveryContext = {
      schemaVersion: 1,
      payment: {
        razorpayPaymentId: 'pay_test002',
        razorpayOrderId: 'order_test002',
        amount: 750000,
        currency: 'INR',
        method: 'upi',
        bank: null,
        wallet: null,
        status: 'FAILED',
        razorpayCreatedAt: new Date().toISOString(),
      },
      failure: {
        category: 'CUSTOMER_ABANDONMENT',
        errorCode: null,
        errorDescription: null,
        errorSource: null,
        errorStep: null,
        errorReason: null,
      },
      customer: {
        tenureDays: 0,
        totalSuccessfulPayments: 0,
        totalFailedPayments: 0,
        lifetimeValue: 0,
        averageOrderValue: 0,
        hasEmail: true,
        hasContact: false,
      },
      recovery: {
        recoveryAttemptCount: 0,
        maxRecoveryAttempts: 3,
        attemptsRemaining: 3,
        previousActionsThisCase: [],
        existingRecoveryLinkUrl: null,
        caseAgeMinutes: 10,
        revenueAtRisk: 750000,
        baselineRecoveryProbability: 0.60,
      },
      policy: {
        recoveryWindowRemainingMinutes: 1430,
        withinContactLimit: true,
        isHighValue: true,
      },
    };

    const decision = makeLLMDecision({
      failure_class: 'CUSTOMER_ABANDONMENT',
      recoverability: 'high',
      confidence: 0.85,
      recovery_probability: 0.70,
      recommended_action: 'CREATE_PAYMENT_LINK',
      reason_codes: ['RECOVERABLE_FAILURE', 'HIGH_VALUE', 'ABANDONED_CHECKOUT'],
    });

    const result = evaluateRecoveryPolicy(context, decision);

    expect(result.approved).toBe(true);
    expect(result.action).toBe('CREATE_PAYMENT_LINK');
    expect(result.stopCondition).toBeNull();
  });
});
