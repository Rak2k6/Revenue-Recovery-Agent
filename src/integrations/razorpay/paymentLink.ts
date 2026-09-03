import Razorpay from 'razorpay';

export interface PaymentLinkInput {
  amount: number; // in paise
  currency?: string;
  description: string;
  referenceId: string; // e.g. recoveryCaseId
  customerEmail?: string | null;
  customerContact?: string | null;
  notes?: Record<string, string>;
}

export interface PaymentLinkResult {
  id: string;
  shortUrl: string;
  status: string;
  raw: any;
}

let razorpayClient: Razorpay | null = null;

export function setRazorpayClient(client: Razorpay | null) {
  razorpayClient = client;
}

export function getRazorpayClient(): Razorpay {
  if (!razorpayClient) {
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';
    razorpayClient = new Razorpay({ key_id, key_secret });
  }
  return razorpayClient;
}

export async function createPaymentLink(input: PaymentLinkInput): Promise<PaymentLinkResult> {
  const rzp = getRazorpayClient();
  
  const payload: any = {
    amount: input.amount,
    currency: input.currency || 'INR',
    description: input.description,
    reference_id: input.referenceId,
    notes: {
      ...input.notes,
      recoveryCaseId: input.referenceId,
    },
  };

  if (input.customerEmail || input.customerContact) {
    payload.customer = {
      email: input.customerEmail || undefined,
      contact: input.customerContact || undefined,
    };
  }

  const response = await rzp.paymentLink.create(payload);

  return {
    id: response.id,
    shortUrl: response.short_url,
    status: response.status,
    raw: response,
  };
}
