// Razorpay raw webhook payload types.
// Only this file and the normalizer are allowed to know these field names.

export interface RazorpayPaymentEntity {
  id: string;
  entity?: string;
  amount: number;
  currency?: string;
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
  order_id?: string | null;
  method?: string | null;
  captured?: boolean;
  bank?: string | null;
  wallet?: string | null;
  email?: string | null;
  contact?: string | null;
  error_code?: string | null;
  error_description?: string | null;
  error_source?: string | null;
  error_step?: string | null;
  error_reason?: string | null;
  amount_refunded?: number;
  refund_status?: string | null;
  fee?: number | null;
  created_at?: number | null; // Unix timestamp from Razorpay
}

export interface RazorpayWebhookPayload {
  id?: string;           // Event ID — present in most but not all webhook deliveries
  entity?: string;       // "event"
  account_id?: string;
  event: string;         // e.g. "payment.failed"
  contains?: string[];
  created_at?: number;   // Unix timestamp of when Razorpay created this event
  payload: {
    payment?: {
      entity: RazorpayPaymentEntity;
    };
    [key: string]: unknown;
  };
}
