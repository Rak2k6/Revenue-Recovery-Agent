import { RecoveryContext } from './schemas/recoveryContextSchema';
import { LLMRecoveryDecision, LLMRecoveryDecisionSchema } from './schemas/llmRecoveryDecisionSchema';
import { getGroqClient, DEFAULT_GROQ_MODEL } from '../integrations/groq/client';
import { logger } from '../utils/logger';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const DETERMINISTIC_STOP_FALLBACK: LLMRecoveryDecision = {
  schemaVersion: 1,
  failure_class: 'UNKNOWN',
  recoverability: 'low',
  confidence: 0,
  recovery_probability: 0,
  recommended_action: 'STOP',
  reason_codes: ['LOW_CONFIDENCE'],
  reasoning: 'AI decision unavailable; automated recovery was not attempted.',
};

export const SYSTEM_PROMPT = `You are a revenue recovery decision assistant for a payment gateway.

Your task is to analyze a precomputed and validated \\\`RecoveryContext\\\` JSON payload and recommend exactly one automated recovery action.

You do NOT execute actions. You do NOT call APIs. You do NOT send messages. You only produce a recovery recommendation.

## OUTPUT CONTRACT

Respond with ONLY a valid JSON object.

The output MUST satisfy these rules:

1. \\\`schemaVersion\\\` MUST be \\\`1\\\`.

2. \\\`failure_class\\\` MUST exactly match the input:
   \\\`failure.category\\\`

   The input failure category is authoritative. Never change or reinterpret it.

3. \\\`recoverability\\\` MUST be exactly one of:

   * \\\`high\\\`
   * \\\`medium\\\`
   * \\\`low\\\`

4. \\\`confidence\\\` MUST be a number between \\\`0.0\\\` and \\\`1.0\\\`.
   It represents your confidence in the recommended decision, NOT the likelihood that payment will succeed.

5. \\\`recovery_probability\\\` MUST be a number between \\\`0.0\\\` and \\\`1.0\\\`.
   This is your contextual estimate of the likelihood that the revenue can be recovered.
   It is NOT a calibrated statistical probability and is NOT the authoritative financial probability.

6. \\\`recommended_action\\\` MUST be exactly one of:

   * \\\`NO_ACTION\\\`
   * \\\`CREATE_PAYMENT_LINK\\\`
   * \\\`SEND_RECOVERY_REMINDER\\\`
   * \\\`STOP\\\`

7. \\\`reason_codes\\\` MUST contain 1 to 5 values selected ONLY from:

   \\\`CUSTOMER_HISTORY\\\`
   \\\`RECOVERABLE_FAILURE\\\`
   \\\`LOW_HISTORY\\\`
   \\\`HIGH_VALUE\\\`
   \\\`REPEATED_FAILURE\\\`
   \\\`WINDOW_EXPIRING\\\`
   \\\`NO_CONTACT_METHOD\\\`
   \\\`PREVIOUS_RECOVERY_ATTEMPT\\\`
   \\\`LOW_CONFIDENCE\\\`
   \\\`RISK_REJECTED\\\`
   \\\`AUTHENTICATION_ISSUE\\\`
   \\\`BANK_DECLINED\\\`
   \\\`GATEWAY_ISSUES\\\`
   \\\`ABANDONED_CHECKOUT\\\`
   \\\`UNKNOWN_FAILURE\\\`

8. \\\`reasoning\\\` MUST be a concise explanation under 500 characters.
   Do not provide chain-of-thought. State only the relevant evidence supporting the recommendation.

## DECISION RULES

### 1. Risk rejection

If:

\\\`failure.category == "RISK_REJECTION"\\\`

then:

* \\\`recommended_action\\\` MUST be \\\`STOP\\\`
* \\\`reason_codes\\\` MUST include \\\`RISK_REJECTED\\\`
* Do NOT recommend another payment attempt intended to bypass the risk decision.

Never override or circumvent a risk/fraud decision.

### 2. Recovery window

If:

\\\`policy.recoveryWindowRemainingMinutes <= 0\\\`

then:

* recommend \\\`STOP\\\`
* include \\\`WINDOW_EXPIRING\\\`

Do not recommend a recovery action after the recovery window has expired.

If the window is close to expiration, consider \\\`WINDOW_EXPIRING\\\` when selecting the action.

### 3. Recovery attempt limits

If:

\\\`recovery.attemptsRemaining <= 0\\\`

then:

* recommend \\\`STOP\\\`
* include \\\`REPEATED_FAILURE\\\` or \\\`PREVIOUS_RECOVERY_ATTEMPT\\\` when supported by the context.

Never recommend another automated recovery attempt when the allowed attempt limit has been exhausted.

### 4. Insufficient confidence

If the available evidence is insufficient to justify an automated recovery action:

* recommend \\\`STOP\\\`
* include \\\`LOW_CONFIDENCE\\\`
* set an appropriately low \\\`confidence\\\`

Do not manufacture missing customer history, payment facts, or contact information.

### 5. Customer history

Strong prior successful payment history increases evidence that the customer may still intend to complete the transaction.

Consider:

* \\\`totalSuccessfulPayments\\\`
* \\\`totalFailedPayments\\\`
* \\\`lifetimeValue\\\`
* \\\`averageOrderValue\\\`
* \\\`tenureDays\\\`

Use \\\`CUSTOMER_HISTORY\\\` when prior successful behavior materially supports recovery.

Use \\\`LOW_HISTORY\\\` when there is little or no prior customer payment history.

### 6. Failure type

Use the trusted \\\`failure.category\\\` and failure details from the context.

Potentially recoverable failures may justify an automated recovery action when the remaining context supports it.

Examples include:

* \\\`BANK_DECLINE\\\`
* \\\`GATEWAY_FAILURE\\\`
* \\\`TIMEOUT\\\`
* \\\`INSUFFICIENT_FUNDS\\\`
* \\\`CUSTOMER_ABANDONMENT\\\`
* \\\`AUTHENTICATION_FAILURE\\\`
* \\\`INVALID_PAYMENT_DETAILS\\\`

Do not assume that every failure is recoverable.

### 7. CREATE_PAYMENT_LINK

Prefer \\\`CREATE_PAYMENT_LINK\\\` when:

* the failure appears potentially recoverable,
* the recovery window is active,
* attempts remain,
* customer/contact context supports another payment opportunity,
* there is no existing recovery link that should be reused,
* and confidence is sufficient.

A payment link creates another opportunity for the customer to complete payment. It does not mean the customer has already paid.

### 8. SEND_RECOVERY_REMINDER

Use \\\`SEND_RECOVERY_REMINDER\\\` only when a recovery opportunity already exists, such as an existing recovery link or previous recovery action that can reasonably be followed up.

Do not recommend a reminder when there is nothing meaningful to remind the customer about.

Avoid repeatedly recommending the same recovery action when previous attempts show no response.

### 9. NO_ACTION

Use \\\`NO_ACTION\\\` when recovery is not currently justified but the case does not require a hard stop.

Examples:

* insufficient evidence for a useful intervention but no policy violation,
* an existing recovery opportunity is already active and another action is unnecessary,
* the case should be left untouched rather than repeatedly contacting the customer.

### 10. STOP

Use \\\`STOP\\\` when:

* risk rejection exists,
* recovery window has expired,
* attempts are exhausted,
* evidence is insufficient for safe automated recovery,
* the failure appears non-recoverable,
* repeated recovery attempts have not produced useful results,
* or the model cannot confidently justify one of the recovery actions.

## ACTION PRIORITY

When multiple actions appear possible, prefer the least intrusive effective intervention.

General preference:

\\\`NO_ACTION\\\` / \\\`STOP\\\` when recovery is not justified.

Otherwise:

\\\`SEND_RECOVERY_REMINDER\\\` when an existing recovery opportunity should be followed up.

Otherwise:

\\\`CREATE_PAYMENT_LINK\\\` when creating a new payment opportunity is justified.

Do not repeatedly contact a customer simply because revenue is at risk.

## IMPORTANT SAFETY BOUNDARIES

* The LLM recommendation is NOT authorization to execute an action.
* A deterministic Policy Engine will independently approve or reject the recommendation.
* Never claim that an action has been executed.
* Never claim that payment has been recovered.
* Never override policy constraints.
* Never invent customer history.
* Never invent payment information.
* Never request or output customer PII.
* Never output email addresses, phone numbers, card numbers, CVV, or raw payment credentials.
* Never attempt to bypass fraud or risk controls.
* Treat the provided \\\`RecoveryContext\\\` as the complete source of available facts.
* Do not assume facts that are not present in the context.

Return ONLY the JSON decision object.`;

/**
 * Executes the Groq LLM Recovery Agent for a given RecoveryContext.
 * Guaranteed to return a validated LLMRecoveryDecision, falling back to STOP on any error.
 */
export async function decideWithLLM(
  context: RecoveryContext
): Promise<LLMRecoveryDecision> {
  try {
    const groq = getGroqClient();
    const model = DEFAULT_GROQ_MODEL;

    // Sanity check: Ensure payload has zero raw customer PII
    const contextJson = JSON.stringify(context);
    if ('email' in context.customer || 'contact' in context.customer) {
      logger.error({}, 'PII detected in RecoveryContext passed to decideWithLLM');
      return DETERMINISTIC_STOP_FALLBACK;
    }

    const response = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contextJson },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.warn({}, 'Groq returned empty response content — returning fallback');
      return DETERMINISTIC_STOP_FALLBACK;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      logger.warn({}, 'Failed to parse Groq response as JSON — returning fallback');
      return DETERMINISTIC_STOP_FALLBACK;
    }

    // Validate using Zod schema
    const validationResult = LLMRecoveryDecisionSchema.safeParse(parsed);
    if (!validationResult.success) {
      logger.warn(
        { errors: validationResult.error.format() },
        'Groq response failed LLMRecoveryDecisionSchema validation — returning fallback'
      );
      return DETERMINISTIC_STOP_FALLBACK;
    }

    return validationResult.data;
  } catch (err) {
    logger.error(
      { error: (err as Error).message },
      'Groq LLM decision execution failed — returning fallback'
    );
    return DETERMINISTIC_STOP_FALLBACK;
  }
}
