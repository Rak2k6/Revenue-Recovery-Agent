/**
 * recoveryPipeline.test.ts
 *
 * Phase 3A: Tests for the reusable runRecoveryPipeline() service.
 *
 * Strategy:
 *   - Mock all four pipeline dependencies at the module boundary.
 *   - Never mock runRecoveryPipeline() itself.
 *   - Verify call order, argument forwarding, and result composition.
 */

import { runRecoveryPipeline } from '../src/recovery/recoveryPipeline';
import * as contextBuilderModule from '../src/recovery/contextBuilder';
import * as llmAgentModule from '../src/recovery/llmAgent';
import * as policyEngineModule from '../src/recovery/policyEngine';
import * as actionExecutorModule from '../src/recovery/actionExecutor';
import { RecoveryContext } from '../src/recovery/schemas/recoveryContextSchema';
import { LLMRecoveryDecision } from '../src/recovery/schemas/llmRecoveryDecisionSchema';
import { PolicyDecision } from '../src/recovery/schemas/policyDecisionSchema';
import { ExecutionResult } from '../src/recovery/actionExecutor';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

jest.mock('../src/recovery/contextBuilder', () => ({
  buildRecoveryContext: jest.fn(),
}));

jest.mock('../src/recovery/llmAgent', () => ({
  decideWithLLM: jest.fn(),
}));

jest.mock('../src/recovery/policyEngine', () => ({
  evaluateRecoveryPolicy: jest.fn(),
}));

jest.mock('../src/recovery/actionExecutor', () => ({
  executeRecoveryAction: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeContext(): RecoveryContext {
  return {
    schemaVersion: 1,
    payment: {
      razorpayPaymentId: 'rzp_pay_abc',
      razorpayOrderId: null,
      amount: 50000,
      currency: 'INR',
      method: 'card',
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
      tenureDays: 5,
      totalSuccessfulPayments: 2,
      totalFailedPayments: 0,
      lifetimeValue: 100000,
      averageOrderValue: 50000,
      hasEmail: true,
      hasContact: true,
    },
    recovery: {
      recoveryAttemptCount: 0,
      maxRecoveryAttempts: 3,
      attemptsRemaining: 3,
      previousActionsThisCase: [],
      existingRecoveryLinkUrl: null,
      caseAgeMinutes: 10,
      revenueAtRisk: 50000,
      baselineRecoveryProbability: 0.65,
    },
    policy: {
      recoveryWindowRemainingMinutes: 1400,
      withinContactLimit: true,
      isHighValue: false,
    },
  };
}

function makeLLMDecision(overrides: Partial<LLMRecoveryDecision> = {}): LLMRecoveryDecision {
  return {
    schemaVersion: 1,
    failure_class: 'CUSTOMER_ABANDONMENT',
    recoverability: 'high',
    confidence: 0.85,
    recovery_probability: 0.70,
    recommended_action: 'CREATE_PAYMENT_LINK',
    reason_codes: ['CUSTOMER_HISTORY', 'RECOVERABLE_FAILURE'],
    reasoning: 'Customer has prior successful payments. Abandonment is recoverable.',
    ...overrides,
  };
}

function makeApprovedPolicy(overrides: Partial<PolicyDecision> = {}): PolicyDecision {
  return {
    schemaVersion: 1,
    approved: true,
    action: 'CREATE_PAYMENT_LINK',
    reason: 'Recovery action is permitted under the current policy constraints.',
    stopCondition: null,
    ...overrides,
  };
}

function makeRejectedPolicy(overrides: Partial<PolicyDecision> = {}): PolicyDecision {
  return {
    schemaVersion: 1,
    approved: false,
    action: 'STOP',
    reason: 'Risk rejection cannot be bypassed by automated recovery.',
    stopCondition: 'RISK_REJECTED',
    ...overrides,
  };
}

function makeExecutionResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    success: true,
    recoveryCaseId: 'case_abc',
    action: 'CREATE_PAYMENT_LINK',
    status: 'COMPLETED',
    paymentLink: { id: 'plink_1', url: 'https://rzp.io/i/test' },
    revenueAtRisk: 50000,
    message: 'Recovery payment link created.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 3A: runRecoveryPipeline()', () => {
  const CASE_ID = 'case_abc';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Test 1: Full pipeline, correct order and argument forwarding ─────────

  it('1. Full pipeline — calls all four stages in order with correct arguments', async () => {
    const context = makeContext();
    const llmDecision = makeLLMDecision();
    const policyDecision = makeApprovedPolicy();
    const executionResult = makeExecutionResult();

    const callOrder: string[] = [];

    (contextBuilderModule.buildRecoveryContext as jest.Mock).mockImplementation(async () => {
      callOrder.push('buildRecoveryContext');
      return context;
    });

    (llmAgentModule.decideWithLLM as jest.Mock).mockImplementation(async () => {
      callOrder.push('decideWithLLM');
      return llmDecision;
    });

    (policyEngineModule.evaluateRecoveryPolicy as jest.Mock).mockImplementation(() => {
      callOrder.push('evaluateRecoveryPolicy');
      return policyDecision;
    });

    (actionExecutorModule.executeRecoveryAction as jest.Mock).mockImplementation(async () => {
      callOrder.push('executeRecoveryAction');
      return executionResult;
    });

    const pipelineResult = await runRecoveryPipeline(CASE_ID);

    // Verify call order
    expect(callOrder).toEqual([
      'buildRecoveryContext',
      'decideWithLLM',
      'evaluateRecoveryPolicy',
      'executeRecoveryAction',
    ]);

    // Verify arguments forwarded correctly
    expect(contextBuilderModule.buildRecoveryContext).toHaveBeenCalledWith(CASE_ID);
    expect(llmAgentModule.decideWithLLM).toHaveBeenCalledWith(context);
    expect(policyEngineModule.evaluateRecoveryPolicy).toHaveBeenCalledWith(context, llmDecision);
    expect(actionExecutorModule.executeRecoveryAction).toHaveBeenCalledWith(
      CASE_ID,
      policyDecision,
      context
    );

    // Verify structured result composition
    expect(pipelineResult.result).toEqual(executionResult);
    expect(pipelineResult.llmDecision).toEqual(llmDecision);
    expect(pipelineResult.policyDecision).toEqual(policyDecision);
    expect(pipelineResult.context).toEqual(context);
  });

  // ── Test 2: Policy rejection propagated to executor ──────────────────────

  it('2. Policy rejection — rejected PolicyDecision is passed to executor (pipeline does not bypass policy)', async () => {
    const context = makeContext();
    const llmDecision = makeLLMDecision({ recommended_action: 'STOP', reason_codes: ['RISK_REJECTED'] });
    const rejectedPolicy = makeRejectedPolicy();
    const skippedResult = makeExecutionResult({
      success: false,
      action: 'STOP',
      status: 'SKIPPED',
      paymentLink: undefined,
      message: 'Risk rejection cannot be bypassed by automated recovery.',
    });

    (contextBuilderModule.buildRecoveryContext as jest.Mock).mockResolvedValue(context);
    (llmAgentModule.decideWithLLM as jest.Mock).mockResolvedValue(llmDecision);
    (policyEngineModule.evaluateRecoveryPolicy as jest.Mock).mockReturnValue(rejectedPolicy);
    (actionExecutorModule.executeRecoveryAction as jest.Mock).mockResolvedValue(skippedResult);

    const pipelineResult = await runRecoveryPipeline(CASE_ID);

    // Policy engine must have been called — pipeline cannot short-circuit it
    expect(policyEngineModule.evaluateRecoveryPolicy).toHaveBeenCalledTimes(1);

    // Executor must receive the rejected policy decision, not an approved one
    expect(actionExecutorModule.executeRecoveryAction).toHaveBeenCalledWith(
      CASE_ID,
      rejectedPolicy,
      context
    );

    // Rejected decision surfaces in result
    expect(pipelineResult.policyDecision.approved).toBe(false);
    expect(pipelineResult.policyDecision.stopCondition).toBe('RISK_REJECTED');
    expect(pipelineResult.result.success).toBe(false);
    expect(pipelineResult.result.status).toBe('SKIPPED');
  });

  // ── Test 3: Executor failure propagates ──────────────────────────────────

  it('3. Executor failure — errors propagate out of runRecoveryPipeline()', async () => {
    const context = makeContext();
    const llmDecision = makeLLMDecision();
    const policyDecision = makeApprovedPolicy();

    (contextBuilderModule.buildRecoveryContext as jest.Mock).mockResolvedValue(context);
    (llmAgentModule.decideWithLLM as jest.Mock).mockResolvedValue(llmDecision);
    (policyEngineModule.evaluateRecoveryPolicy as jest.Mock).mockReturnValue(policyDecision);
    (actionExecutorModule.executeRecoveryAction as jest.Mock).mockRejectedValue(
      new Error('Unexpected DB failure during executor')
    );

    await expect(runRecoveryPipeline(CASE_ID)).rejects.toThrow(
      'Unexpected DB failure during executor'
    );

    // All three preceding stages were still called
    expect(contextBuilderModule.buildRecoveryContext).toHaveBeenCalledTimes(1);
    expect(llmAgentModule.decideWithLLM).toHaveBeenCalledTimes(1);
    expect(policyEngineModule.evaluateRecoveryPolicy).toHaveBeenCalledTimes(1);
    expect(actionExecutorModule.executeRecoveryAction).toHaveBeenCalledTimes(1);
  });

  // ── Test 4: Context failure — LLM/policy/executor are NOT called ─────────

  it('4. Context failure — LLM, policy, and executor are NOT called when context building fails', async () => {
    (contextBuilderModule.buildRecoveryContext as jest.Mock).mockRejectedValue(
      new Error('RecoveryCase not found for ID: case_missing')
    );

    await expect(runRecoveryPipeline('case_missing')).rejects.toThrow(
      'RecoveryCase not found for ID: case_missing'
    );

    // Nothing after context builder should have run
    expect(llmAgentModule.decideWithLLM).not.toHaveBeenCalled();
    expect(policyEngineModule.evaluateRecoveryPolicy).not.toHaveBeenCalled();
    expect(actionExecutorModule.executeRecoveryAction).not.toHaveBeenCalled();
  });

  // ── Test 5: LLM failure — policy/executor are NOT called ─────────────────

  it('5. LLM failure — policy and executor are NOT called when LLM throws', async () => {
    const context = makeContext();

    (contextBuilderModule.buildRecoveryContext as jest.Mock).mockResolvedValue(context);
    (llmAgentModule.decideWithLLM as jest.Mock).mockRejectedValue(
      new Error('Groq rate limit exceeded — unexpected throw')
    );

    await expect(runRecoveryPipeline(CASE_ID)).rejects.toThrow(
      'Groq rate limit exceeded — unexpected throw'
    );

    expect(contextBuilderModule.buildRecoveryContext).toHaveBeenCalledTimes(1);
    expect(llmAgentModule.decideWithLLM).toHaveBeenCalledTimes(1);
    expect(policyEngineModule.evaluateRecoveryPolicy).not.toHaveBeenCalled();
    expect(actionExecutorModule.executeRecoveryAction).not.toHaveBeenCalled();
  });
});
