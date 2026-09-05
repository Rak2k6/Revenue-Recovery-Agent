import React from 'react';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { CustomerNotification } from '../types/notification';

interface PaymentFailureScreenProps {
  orderId: string;
  amount: number;
  failureReason?: string;
  latestRecoveryNotification?: CustomerNotification;
  onOpenRecovery: (notification: CustomerNotification) => void;
  onRetryOriginal: () => void;
  isPolling: boolean;
}

export const PaymentFailureScreen: React.FC<PaymentFailureScreenProps> = ({
  orderId,
  amount,
  failureReason = 'Bank card authorization timeout / gateway error',
  latestRecoveryNotification,
  onOpenRecovery,
  onRetryOriginal,
  isPolling,
}) => {
  const isLinkReady =
    latestRecoveryNotification?.type === 'PAYMENT_RECOVERY' ||
    latestRecoveryNotification?.state === 'ACTION_REQUIRED';

  return (
    <div className="w-full bg-[#FBFBF9] border-b border-[#E5E5E2]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        {/* Left Column: Checkout Review & Awaiting Confirmation */}
        <section className="lg:col-span-7 p-8 sm:p-14 lg:p-16 border-b lg:border-b-0 lg:border-r border-[#E5E5E2] flex flex-col justify-center bg-white">
          <div className="max-w-lg">
            <div className="text-[10px] uppercase tracking-[0.2em] mb-4 text-[#9A9A95] font-semibold">
              Checkout Review • Order #{orderId}
            </div>

            <h1 className="text-4xl sm:text-5xl font-serif italic leading-[1.1] mb-6 text-[#1A1A1A]">
              We need one more payment step.
            </h1>

            <p className="text-[#666662] leading-relaxed mb-8 text-sm sm:text-base font-sans">
              Your payment could not be completed ({failureReason}). Your order is still reserved while we confirm the next available payment option.
            </p>

            {/* Price Itemization Breakdown */}
            <div className="space-y-4 mb-8">
              <div className="flex justify-between border-b border-[#E5E5E2] pb-4">
                <span className="text-sm opacity-70 italic font-serif">Item Subtotal</span>
                <span className="text-sm font-medium text-[#1A1A1A]">₹2,499.00</span>
              </div>
              <div className="flex justify-between border-b border-[#E5E5E2] pb-4">
                <span className="text-sm opacity-70 italic font-serif">Express Logistics</span>
                <span className="text-sm font-medium text-[#1A1A1A]">₹0.00</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-lg font-serif italic text-[#1A1A1A]">Grand Total Due</span>
                <span className="text-xl font-serif font-semibold text-[#1A1A1A]">₹{amount.toLocaleString('en-IN')}.00</span>
              </div>
            </div>

            {/* Secondary navigation */}
            <div className="pt-2 flex items-center justify-between text-xs text-[#9A9A95]">
              <button
                onClick={onRetryOriginal}
                className="text-[#1A1A1A] hover:underline font-medium text-[11px] uppercase tracking-wider"
              >
                ← Return to store & checkout again
              </button>
              <span className="text-[10px] uppercase tracking-wider">
                Support: concierge@luminasound.in
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: Editorial Recovery Card & Status Pipeline */}
        <section className="lg:col-span-5 bg-[#F4F4F1] p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
          
          {/* Recovery Link Card (Editorial Floating Card from Design) */}
          {isLinkReady && latestRecoveryNotification ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-sm mx-auto bg-white shadow-[20px_20px_60px_rgba(0,0,0,0.06)] rounded-sm border border-[#E5E5E2] overflow-hidden mb-8"
            >
              {/* Card Header with Terracotta Action Tag */}
              <div className="p-6 border-b border-[#F0F0EE] flex justify-between items-center bg-white">
                <span className="text-[10px] uppercase tracking-widest font-bold text-[#D44D2F] flex items-center">
                  <span className="w-1.5 h-1.5 bg-[#D44D2F] rounded-full mr-2 animate-pulse" />
                  Action Required
                </span>
                <span className="text-[10px] text-[#9A9A95] uppercase tracking-wider">
                  Backend Link Ready
                </span>
              </div>

              {/* Card Body */}
              <div className="p-8">
                <h3 className="text-lg font-serif mb-3 italic text-[#1A1A1A]">
                  {latestRecoveryNotification.title}
                </h3>
                <p className="text-sm text-[#666662] leading-relaxed mb-6 font-sans">
                  {latestRecoveryNotification.message}
                </p>

                <button
                  id="complete-payment-banner-btn"
                  onClick={() => onOpenRecovery(latestRecoveryNotification)}
                  className="block w-full bg-[#1A1A1A] text-white text-center py-4 text-xs uppercase tracking-widest font-bold hover:bg-[#333] transition-colors cursor-pointer"
                >
                  {latestRecoveryNotification.actionLabel || 'Complete Payment'}
                </button>
              </div>

              {/* Security Strip */}
              <div className="px-8 py-3 bg-[#FBFBF9] border-t border-[#F0F0EE]">
                <p className="text-[9px] text-[#9A9A95] leading-normal uppercase tracking-tighter">
                  Transaction Security: Powered by Razorpay Secure Pipeline
                </p>
              </div>
            </motion.div>
          ) : (
            /* Evaluating / Pipeline Active Card */
            <div className="w-full max-w-sm mx-auto bg-white shadow-[20px_20px_60px_rgba(0,0,0,0.06)] rounded-sm border border-[#E5E5E2] overflow-hidden mb-8 p-8">
              <div className="flex items-center gap-2 mb-4">
                <RefreshCw className="w-4 h-4 text-[#D44D2F] animate-spin" />
                <span className="text-[10px] uppercase tracking-widest font-bold text-[#D44D2F]">
                  Payment update in progress
                </span>
              </div>
              <h3 className="text-lg font-serif italic text-[#1A1A1A] mb-2">
                Preparing a secure payment option
              </h3>
              <p className="text-xs text-[#666662] leading-relaxed mb-6">
                We are checking your payment status. A secure payment link will appear here when it is ready.
              </p>
              <div className="flex items-center gap-2 text-[10px] text-[#9A9A95] uppercase tracking-wider">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                Checking payment status ({isPolling ? 'active' : 'idle'})
              </div>
            </div>
          )}

          {/* Vertical Pipeline Steps matching Design HTML */}
          <div className="w-full max-w-sm mx-auto space-y-6 pt-4 border-t border-[#E5E5E2]">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-[#E5E5E2] text-xs font-serif italic">
                ✓
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#666662]">
                Order Received (#ORD-{orderId.slice(-4)})
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 rounded-full bg-[#D44D2F] flex items-center justify-center border border-[#D44D2F] text-white text-xs">
                ✕
              </div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]">
                Payment Issue Detected
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center border border-[#E5E5E2] ${!isLinkReady ? 'animate-pulse' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${isLinkReady ? 'bg-emerald-600' : 'bg-[#1A1A1A]'}`} />
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#666662]">
                {isLinkReady ? 'Secure payment link ready' : 'Checking payment status'}
              </div>
            </div>
          </div>

        </section>

      </div>
    </div>
  );
};
