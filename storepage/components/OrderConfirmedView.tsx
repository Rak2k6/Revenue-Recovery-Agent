import React from 'react';
import { Check, ArrowRight, Download } from 'lucide-react';
import { motion } from 'motion/react';

interface OrderConfirmedViewProps {
  orderId: string;
  amount: number;
  paymentMethod: string;
  onBackToStore: () => void;
}

export const OrderConfirmedView: React.FC<OrderConfirmedViewProps> = ({
  orderId,
  amount,
  paymentMethod,
  onBackToStore,
}) => {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28 }}
        className="bg-white border border-[#E5E5E2] shadow-[20px_20px_60px_rgba(0,0,0,0.06)] rounded-sm overflow-hidden"
      >
        {/* Top Celebration Banner in Editorial styling */}
        <div className="p-10 text-center border-b border-[#E5E5E2] bg-white">
          <div className="w-12 h-12 rounded-full border border-[#E5E5E2] bg-[#FBFBF9] text-[#1A1A1A] flex items-center justify-center mx-auto mb-4">
            <Check className="w-5 h-5" />
          </div>

          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-emerald-800 block mb-2">
            Payment Recovered & Confirmed
          </span>

          <h2 className="text-3xl sm:text-4xl font-serif italic text-[#1A1A1A] mb-2">
            Order Confirmed.
          </h2>
          <p className="text-xs sm:text-sm text-[#666662] max-w-md mx-auto leading-relaxed">
            Thank you, Rahul. Your transaction has been securely captured, and order #{orderId} is being prepared at our studio.
          </p>
        </div>

        {/* Receipt Details */}
        <div className="p-8 sm:p-10 space-y-6">
          <div className="p-6 bg-[#FBFBF9] border border-[#E5E5E2] space-y-3">
            <div className="flex items-center justify-between text-xs pb-3 border-b border-[#E5E5E2]">
              <span className="text-[#666662] font-serif italic">Order Reference</span>
              <span className="font-mono font-medium text-[#1A1A1A]">{orderId}</span>
            </div>
            <div className="flex items-center justify-between text-xs pb-3 border-b border-[#E5E5E2]">
              <span className="text-[#666662] font-serif italic">Settlement Gateway</span>
              <span className="font-medium text-[#1A1A1A]">{paymentMethod} (Verified)</span>
            </div>
            <div className="flex items-center justify-between text-xs pb-3 border-b border-[#E5E5E2]">
              <span className="text-[#666662] font-serif italic">Reserved Article</span>
              <span className="font-medium text-[#1A1A1A]">Aura Studio Hi-Fi Wireless Headphones</span>
            </div>
            <div className="flex items-center justify-between text-sm font-serif text-[#1A1A1A] pt-2">
              <span className="italic">Amount Captured</span>
              <span className="font-sans font-semibold text-base text-[#1A1A1A]">₹{amount.toLocaleString('en-IN')}.00</span>
            </div>
          </div>

          <div className="p-4 border border-[#E5E5E2] bg-white text-xs text-[#666662] leading-relaxed">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] block mb-1">
              Logistics Dispatch
            </span>
            Complimentary 2-Day Air Courier from Mumbai Logistics Hub to Bandra West. Real-time transit updates will be pushed directly to your notifications.
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={onBackToStore}
              className="w-full sm:flex-1 py-4 px-6 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Return to Collections</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => window.print()}
              className="w-full sm:w-auto py-4 px-6 border border-[#E5E5E2] hover:bg-[#F4F4F1] text-[#1A1A1A] text-xs uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
