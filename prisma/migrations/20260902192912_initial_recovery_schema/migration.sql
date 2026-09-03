-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FailureCategory" AS ENUM ('CUSTOMER_ABANDONMENT', 'BANK_DECLINE', 'GATEWAY_FAILURE', 'AUTHENTICATION_FAILURE', 'INSUFFICIENT_FUNDS', 'INVALID_PAYMENT_DETAILS', 'TIMEOUT', 'RISK_REJECTION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RecoverabilityStatus" AS ENUM ('PENDING_ASSESSMENT', 'RECOVERABLE', 'NOT_RECOVERABLE', 'RECOVERED', 'RECOVERY_FAILED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('NONE', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "contact" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "razorpay_payment_id" TEXT NOT NULL,
    "razorpay_order_id" TEXT,
    "customer_id" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "method" TEXT,
    "status" "PaymentStatus" NOT NULL,
    "captured" BOOLEAN NOT NULL DEFAULT false,
    "bank" TEXT,
    "wallet" TEXT,
    "error_code" TEXT,
    "error_description" TEXT,
    "error_source" TEXT,
    "error_step" TEXT,
    "error_reason" TEXT,
    "amount_refunded" INTEGER NOT NULL DEFAULT 0,
    "refund_status" TEXT,
    "razorpay_created_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "razorpay_event_id" TEXT,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature_verified" BOOLEAN NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_cases" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "failure_category" "FailureCategory" NOT NULL DEFAULT 'UNKNOWN',
    "revenue_at_risk" INTEGER NOT NULL,
    "recoverability_status" "RecoverabilityStatus" NOT NULL DEFAULT 'PENDING_ASSESSMENT',
    "recovery_probability" DOUBLE PRECISION,
    "priority" TEXT,
    "recommended_action" TEXT,
    "preferred_method" TEXT,
    "reasoning" TEXT,
    "confidence" DOUBLE PRECISION,
    "stop_condition" TEXT,
    "action_status" "ActionStatus" NOT NULL DEFAULT 'NONE',
    "recovery_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_recovery_attempts" INTEGER NOT NULL DEFAULT 3,
    "recovery_link_id" TEXT,
    "recovery_link_url" TEXT,
    "amount_recovered" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_audit_logs" (
    "id" TEXT NOT NULL,
    "recovery_case_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL,
    "amount_recovered" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpay_payment_id_key" ON "payments"("razorpay_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_idempotency_key_key" ON "webhook_events"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_cases_payment_id_key" ON "recovery_cases"("payment_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_audit_logs" ADD CONSTRAINT "recovery_audit_logs_recovery_case_id_fkey" FOREIGN KEY ("recovery_case_id") REFERENCES "recovery_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
