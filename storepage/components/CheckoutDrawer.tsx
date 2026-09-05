import React, { useState } from 'react';
import { X, ShieldCheck, CreditCard, Smartphone, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onProcessCheckout: (shouldFail: boolean) => Promise<void>;
  price: number;
}

export const CheckoutDrawer: React.FC<CheckoutDrawerProps> = ({
  isOpen,
  onClose,
  onProcessCheckout,
  price,
}) => {
  const [shouldSimulateFailure, setShouldSimulateFailure] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card'>('upi');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onProcessCheckout(shouldSimulateFailure);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="w-screen max-w-md bg-[#FBFBF9] border-l border-[#E5E5E2] shadow-[20px_20px_60px_rgba(0,0,0,0.12)] flex flex-col"
          >
            {/* Header */}
            <div className="p-8 border-b border-[#E5E5E2] flex items-center justify-between bg-white">
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#9A9A95] font-semibold block mb-1">
                  Private Order
                </span>
                <h3 className="text-2xl font-serif italic text-[#1A1A1A]">Checkout Review</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-[#9A9A95] hover:text-[#1A1A1A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {/* Order Summary in Editorial styling */}
              <div className="p-6 bg-white border border-[#E5E5E2] space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#F4F4F1] border border-[#E5E5E2] p-1 shrink-0">
                    <img
                      src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&auto=format&fit=crop&q=80"
                      alt="Headphones"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-serif italic text-[#1A1A1A] truncate">
                      Aura Studio Hi-Fi Wireless
                    </h5>
                    <p className="text-[10px] uppercase tracking-wider text-[#9A9A95]">Obsidian • Qty: 1</p>
                    <span className="text-xs font-semibold text-[#1A1A1A]">₹{price.toLocaleString('en-IN')}.00</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0F0EE] space-y-2 text-xs">
                  <div className="flex justify-between text-[#666662]">
                    <span className="font-serif italic">Subtotal</span>
                    <span>₹{price.toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="flex justify-between text-[#666662]">
                    <span className="font-serif italic">Courier Delivery</span>
                    <span className="text-xs font-semibold text-[#1A1A1A]">FREE</span>
                  </div>
                  <div className="flex justify-between font-serif italic text-sm text-[#1A1A1A] pt-2 border-t border-[#F0F0EE]">
                    <span>Acquisition Total</span>
                    <span className="font-sans font-semibold text-base">₹{price.toLocaleString('en-IN')}.00</span>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#9A9A95] font-semibold block">
                  Delivery Destination
                </label>
                <div className="p-4 bg-white border border-[#E5E5E2] text-xs space-y-1">
                  <p className="font-semibold text-[#1A1A1A]">Rahul Sharma</p>
                  <p className="text-[#666662]">customer@example.com • +91 98765 43210</p>
                  <p className="text-[#9A9A95] text-[11px]">402, Sea View Residency, Bandra West, Mumbai 400050</p>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#9A9A95] font-semibold block">
                  Payment Protocol
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('upi')}
                    className={`p-4 border text-left text-xs transition-all cursor-pointer ${
                      selectedMethod === 'upi'
                        ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                        : 'border-[#E5E5E2] bg-white text-[#1A1A1A] hover:border-[#9A9A95]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Smartphone className="w-4 h-4" />
                      {selectedMethod === 'upi' && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="font-semibold text-xs">UPI / Direct QR</div>
                    <div className={`text-[10px] mt-0.5 ${selectedMethod === 'upi' ? 'text-[#9A9A95]' : 'text-[#666662]'}`}>
                      Instant authorization
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('card')}
                    className={`p-4 border text-left text-xs transition-all cursor-pointer ${
                      selectedMethod === 'card'
                        ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                        : 'border-[#E5E5E2] bg-white text-[#1A1A1A] hover:border-[#9A9A95]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <CreditCard className="w-4 h-4" />
                      {selectedMethod === 'card' && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="font-semibold text-xs">Bank Card</div>
                    <div className={`text-[10px] mt-0.5 ${selectedMethod === 'card' ? 'text-[#9A9A95]' : 'text-[#666662]'}`}>
                      Visa, MasterCard
                    </div>
                  </button>
                </div>
              </div>

              {/* Hackathon Demo Scenario Switch with Editorial Rust accent */}
              <div className="p-4 border border-[#E5E5E2] bg-white text-xs space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-[#D44D2F] mt-1.5 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#D44D2F] block">
                      Hackathon Demo Scenario
                    </span>
                    <p className="text-[#666662] text-xs leading-relaxed mt-1">
                      Simulate payment failure to demonstrate the backend AI recovery pipeline and customer notification workflow.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#F0F0EE]">
                  <span className="text-[11px] font-medium text-[#1A1A1A]">
                    Simulate Payment Failure
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shouldSimulateFailure}
                      onChange={(e) => setShouldSimulateFailure(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#E5E5E2] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D44D2F]"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer Checkout Action */}
            <div className="p-8 border-t border-[#E5E5E2] bg-white">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-[#1A1A1A] hover:bg-[#333] disabled:bg-[#9A9A95] text-white text-xs uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Contacting Banking Gateway...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Transact • ₹{price.toLocaleString('en-IN')}</span>
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <p className="text-center text-[10px] uppercase tracking-wider text-[#9A9A95] mt-3">
                Transaction Security: Powered by Razorpay Secure Pipeline
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
