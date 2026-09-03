# Razorpay AI Revenue Recovery Agent

An intelligent, autonomous revenue recovery system built on top of Razorpay. It captures failed payments, analyzes customer history, makes AI-driven recovery decisions using Groq LLM, enforces deterministic business policies, and safely executes recovery actions like creating Razorpay Payment Links.

## Architecture

The system is designed as a secure pipeline ensuring that AI recommendations are strictly authorized before execution.

```mermaid
graph TD
    A[Razorpay Webhook (payment.failed)] -->|Phase 1| B[RecoveryCase Created]
    B -->|Phase 2C| C[RecoveryContext Builder]
    C -->|Phase 2D| D[Groq LLM Agent]
    D -->|Phase 2E| E[Deterministic Policy Engine]
    E -->|Phase 2F| F[Safe Action Executor]
    F -->|Razorpay API| G[Outcome (Payment Link)]
```

### Key Components

*   **Webhook Processor (Phase 1):** Captures Razorpay webhooks idempotently, normalizing raw payloads into a canonical `WebhookEvent` and initializing a `RecoveryCase`.
*   **Recovery Context Builder (Phase 2C):** Constructs a strict, Zod-validated JSON contract representing the state of the failed payment, customer history, and policy limits, explicitly scrubbing PII.
*   **LLM Decision Agent (Phase 2D):** Analyzes the `RecoveryContext` using Groq (e.g., `openai/gpt-oss-120b`) and recommends an action (e.g., `CREATE_PAYMENT_LINK`, `NO_ACTION`, `STOP`) via structured JSON output.
*   **Deterministic Policy Engine (Phase 2E):** The ultimate authorization boundary. It evaluates the LLM's recommendation against hardcoded business rules (e.g., Risk Rejection, Attempt Limits, Confidence Thresholds) and returns a final `PolicyDecision`.
*   **Safe Action Executor (Phase 2F):** Executes the approved `PolicyDecision`. It uses database-level atomic locking for concurrency protection, enforces idempotency, and communicates with the Razorpay API to execute recovery actions safely.

## Features

*   **PII Protection:** Customer email, phone numbers, and raw payment credentials are never sent to the LLM.
*   **Idempotency & Concurrency:** Robust protections against duplicate webhook deliveries and concurrent execution requests ensuring a recovery action (like a payment link) is only created once.
*   **Safety First:** The LLM cannot authorize actions. It acts purely as an advisor to the Policy Engine. Monetary amounts are never determined by the LLM.
*   **Audit Logging:** Every step of the recovery lifecycle is meticulously logged in `RecoveryAuditLog` for transparency and debugging.

## Tech Stack

*   Node.js & TypeScript
*   Express.js
*   Prisma ORM (PostgreSQL)
*   Zod (Schema Validation)
*   Razorpay SDK
*   Groq SDK

## Setup & Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Rak2k6/Revenue-Recovery-Agent.git
    cd Revenue-Recovery-Agent
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Configuration:**
    Create a `.env` file in the root directory and configure the following variables:
    ```env
    PORT=3000
    DATABASE_URL="postgresql://user:password@localhost:5432/razorpay_recovery"
    INTERNAL_API_KEY="your_internal_api_key_for_testing"

    # Razorpay Credentials
    RAZORPAY_KEY_ID="rzp_test_..."
    RAZORPAY_KEY_SECRET="your_razorpay_secret"
    RAZORPAY_WEBHOOK_SECRET="your_webhook_secret"

    # Groq Configuration
    GROQ_API_KEY="gsk_..."
    GROQ_MODEL="openai/gpt-oss-120b"
    ```

4.  **Database Setup:**
    ```bash
    npx prisma generate
    npx prisma db push
    ```

5.  **Run the application:**
    ```bash
    npm run dev
    ```

6.  **Run Tests:**
    ```bash
    npm test
    ```

## API Endpoints

*   `POST /webhooks/razorpay`: Ingests Razorpay webhook events.
*   `GET /recovery-cases`: Lists paginated recovery cases.
*   `GET /recovery-cases/:id`: Retrieves details of a specific recovery case.
*   `POST /recovery-cases/:id/execute`: Executes the full AI recovery pipeline for a specific case.
*   `GET /recovery-metrics`: Retrieves aggregate revenue recovery metrics.
