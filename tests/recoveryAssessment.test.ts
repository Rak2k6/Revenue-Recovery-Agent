import { Payment, RecoveryCase } from '@prisma/client';
import { decideRecoveryAction } from '../src/recovery/decisionEngine';
import { validateRecoveryDecision } from '../src/recovery/policyGuardrail';
import { FailureCategory } from '../src/models/internalTypes';

describe('Recovery Assessment Logic', () => {
  const createMockCase = (category: string, revenueAtRisk = 50000, attemptCount = 0): RecoveryCase => ({
    id: 'case_1',
    paymentId: 'pay_1',
    failureCategory: category as any,
    revenueAtRisk,
    recoverabilityStatus: 'PENDING_ASSESSMENT',
    recoveryProbability: null,
    priority: null,
    recommendedAction: null,
    preferredMethod: null,
    reasoning: null,
    confidence: null,
    stopCondition: null,
    actionStatus: 'NONE',
    recoveryAttemptCount: attemptCount,
    maxRecoveryAttempts: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createMockPayment = (status: any = 'FAILED', method: string | null = 'card'): Payment => ({
    id: 'pay_1',
    razorpayPaymentId: 'rzp_pay_1',
    razorpayOrderId: null,
    customerId: 'cust_1',
    amount: 50000,
    currency: 'INR',
    method,
    status,
    captured: status === 'CAPTURED',
    bank: null,
    wallet: null,
    errorCode: null,
    errorDescription: null,
    errorSource: null,
    errorStep: null,
    errorReason: null,
    amountRefunded: status === 'REFUNDED' ? 50000 : 0,
    refundStatus: status === 'REFUNDED' ? 'full' : null,
    razorpayCreatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('1. Customer cancellation -> CUSTOMER_ABANDONMENT', () => {
    const rc = createMockCase('CUSTOMER_ABANDONMENT');
    const payment = createMockPayment();
    const decision = decideRecoveryAction(rc, payment, []);
    
    expect(decision.failureCategory).toBe('CUSTOMER_ABANDONMENT');
    expect(['CREATE_PAYMENT_LINK', 'CUSTOMER_REENGAGEMENT']).toContain(decision.recommendedAction);
    
    const policy = validateRecoveryDecision(decision, rc, payment);
    expect(policy.allowed).toBe(true);
  });

  it('2. Bank decline -> BANK_DECLINE', () => {
    const rc = createMockCase('BANK_DECLINE');
    const payment = createMockPayment();
    const decision = decideRecoveryAction(rc, payment, []);
    
    expect(decision.recommendedAction).toBe('ALTERNATIVE_PAYMENT_METHOD');
    
    const policy = validateRecoveryDecision(decision, rc, payment);
    expect(policy.allowed).toBe(true);
  });

  it('3. Gateway failure -> GATEWAY_FAILURE', () => {
    const rc = createMockCase('GATEWAY_FAILURE');
    const payment = createMockPayment();
    const decision = decideRecoveryAction(rc, payment, []);
    
    expect(decision.recommendedAction).toBe('RETRY_PAYMENT');
  });

  it('4. Risk rejection -> RISK_REJECTION', () => {
    const rc = createMockCase('RISK_REJECTION');
    const payment = createMockPayment();
    const decision = decideRecoveryAction(rc, payment, []);
    
    expect(['NO_ACTION', 'ESCALATE']).toContain(decision.recommendedAction);
    expect(decision.maxAttempts).toBe(0);
    
    const policy = validateRecoveryDecision(decision, rc, payment);
    expect(policy.allowed).toBe(false); // blocked by policy
  });

  it('5. Captured payment -> Blocked by policy', () => {
    const rc = createMockCase('CUSTOMER_ABANDONMENT');
    const payment = createMockPayment('CAPTURED');
    const decision = decideRecoveryAction(rc, payment, []);
    
    const policy = validateRecoveryDecision(decision, rc, payment);
    expect(policy.allowed).toBe(false);
    expect(policy.reason).toContain('captured or refunded');
  });

  it('6. Refunded payment -> Blocked by policy', () => {
    const rc = createMockCase('CUSTOMER_ABANDONMENT');
    const payment = createMockPayment('REFUNDED');
    const decision = decideRecoveryAction(rc, payment, []);
    
    const policy = validateRecoveryDecision(decision, rc, payment);
    expect(policy.allowed).toBe(false);
    expect(policy.reason).toContain('captured or refunded');
  });

  it('7. Repeated recovery attempt -> Blocked by policy', () => {
    // Attempt count is 1, max is 1 for some types
    const rc = createMockCase('BANK_DECLINE', 50000, 1);
    const payment = createMockPayment();
    const decision = decideRecoveryAction(rc, payment, []); // maxAttempts is 1 for BANK_DECLINE
    
    expect(decision.maxAttempts).toBe(1);
    const policy = validateRecoveryDecision(decision, rc, payment);
    expect(policy.allowed).toBe(false);
    expect(policy.reason).toContain('Max recovery attempts');
  });

  it('8. Customer with successful UPI history -> UPI recommended', () => {
    const rc = createMockCase('BANK_DECLINE');
    const payment = createMockPayment('FAILED', 'netbanking'); // current failure is netbanking
    
    const pastPayments = [
      createMockPayment('CAPTURED', 'upi'),
      createMockPayment('CAPTURED', 'upi'),
      createMockPayment('FAILED', 'wallet')
    ];
    
    const decision = decideRecoveryAction(rc, payment, pastPayments);
    
    expect(decision.recommendedAction).toBe('ALTERNATIVE_PAYMENT_METHOD');
    expect(decision.preferredPaymentMethod).toBe('upi');
  });

  it('9. Unknown failure -> REVIEW_REQUIRED', () => {
    const rc = createMockCase('UNKNOWN');
    const payment = createMockPayment();
    const decision = decideRecoveryAction(rc, payment, []);
    
    expect(decision.recoverability).toBe('REVIEW_REQUIRED');
    
    const policy = validateRecoveryDecision(decision, rc, payment);
    expect(policy.allowed).toBe(false);
    expect(policy.reason).toContain('manual review');
  });

  it('10. High-value transaction -> Higher recovery priority', () => {
    // 50,000 INR = 5,000,000 paise
    const rcHighValue = createMockCase('BANK_DECLINE', 5000000);
    const payment = createMockPayment();
    const decision = decideRecoveryAction(rcHighValue, payment, []);
    
    expect(['HIGH', 'CRITICAL']).toContain(decision.priority);
  });
});
