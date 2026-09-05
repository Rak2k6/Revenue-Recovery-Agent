import React, { useState } from 'react';
import { X, ShieldCheck, Check, Smartphone, CreditCard, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CustomerNotification } from '../types/notification';

interface RecoveryPaymentModalProps {
  isOpen: boolean;
  notification: CustomerNotification | null;
  onClose: () => void;
  onCompleteRecovery: (tokenOrCaseId: string, paymentMethod: string) => Promise<void>;
  amount: number;
}

export const RecoveryPaymentModal: React.FC<RecoveryPaymentModalProps> = ({
  isOpen,
  notification,
  onClose,
  onCompleteRecovery,
  amount,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'Razorpay UPI' | 'Card'>('Razorpay UPI');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !notification) return null;

  const backendRecoveryUrl = notification.recoveryLinkUrl || notification.actionUrl || '';
  const recoveryToken = notification.recoveryCaseId || backendRecoveryUrl.split('/').pop() || 'rec_default';

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      await onCompleteRecovery(recoveryToken, selectedMethod);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-white border border-[#E5E5E2] shadow-[20px_20px_60px_rgba(0,0,0,0.12)] rounded-sm overflow-hidden"
        >
          {/* Header Banner in Editorial styling */}
          <div className="p-8 border-b border-[#F0F0EE] bg-white relative">
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-1.5 text-[#9A9A95] hover:text-[#1A1A1A] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] uppercase tracking-widest font-bold text-[#D44D2F] flex items-center mb-2">
              <span className="w-1.5 h-1.5 bg-[#D44D2F] rounded-full mr-2 animate-pulse" />
              Secure Payment Session
            </span>

            <h3 className="text-2xl font-serif italic text-[#1A1A1A]">
              {notification.title}
            </h3>
            <p className="text-xs text-[#666662] mt-2 leading-relaxed font-sans">
              {notification.message}
            </p>
          </div>

          {/* Body */}
          <div className="p-8 space-y-6">
            {/* Backend Verification Details */}
            <div className="p-4 bg-[#FBFBF9] border border-[#E5E5E2] space-y-2 text-xs">
              <div className="flex justify-between items-center text-[#666662]">
                <span className="font-serif italic">Reserved Article</span>
                <span className="font-medium text-[#1A1A1A]">Aura Studio Hi-Fi Wireless</span>
              </div>
              <div className="flex justify-between items-center text-[#666662]">
                <span className="font-serif italic">Payment status</span>
                <span className="text-[11px] text-[#1A1A1A]">Secure link ready</span>
              </div>
              <div className="flex justify-between items-center text-[#1A1A1A] font-serif pt-2 border-t border-[#E5E5E2]">
                <span className="italic text-sm">Outstanding Due</span>
                <span className="text-lg font-semibold font-sans">₹{amount.toLocaleString('en-IN')}.00</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] text-[#9A9A95] font-semibold block">
                Select Payment Method
              </label>

              <button
                type="button"
                onClick={() => setSelectedMethod('Razorpay UPI')}
                className={`w-full p-4 border flex items-center justify-between text-left transition-all cursor-pointer ${
                  selectedMethod === 'Razorpay UPI'
                    ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                    : 'border-[#E5E5E2] hover:border-[#9A9A95] text-[#1A1A1A] bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4" />
                  <div>
                    <div className="text-xs font-semibold">Instant UPI / QR (Frictionless)</div>
                    <div className={`text-[10px] ${selectedMethod === 'Razorpay UPI' ? 'text-[#9A9A95]' : 'text-[#666662]'}`}>
                      Zero gateway drop rate
                    </div>
                  </div>
                </div>
                {selectedMethod === 'Razorpay UPI' && <Check className="w-4 h-4 text-white" />}
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('Card')}
                className={`w-full p-4 border flex items-center justify-between text-left transition-all cursor-pointer ${
                  selectedMethod === 'Card'
                    ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                    : 'border-[#E5E5E2] hover:border-[#9A9A95] text-[#1A1A1A] bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4" />
                  <div>
                    <div className="text-xs font-semibold">Bank Card Alternative</div>
                    <div className={`text-[10px] ${selectedMethod === 'Card' ? 'text-[#9A9A95]' : 'text-[#666662]'}`}>
                      Visa, Mastercard, RuPay
                    </div>
                  </div>
                </div>
                {selectedMethod === 'Card' && <Check className="w-4 h-4 text-white" />}
              </button>
            </div>

            {/* Complete Payment Button */}
            <div className="pt-2">
              <button
                id="submit-recovery-payment-btn"
                onClick={handlePay}
                disabled={isProcessing}
                className="w-full py-4 px-6 bg-[#1A1A1A] hover:bg-[#333] disabled:bg-[#9A9A95] text-white text-xs uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Confirming Recovery Payment...</span>
                  </>
                ) : (
                  <span>Complete Payment • ₹{amount.toLocaleString('en-IN')}</span>
                )}
              </button>

              <p className="text-center text-[9px] uppercase tracking-wider text-[#9A9A95] mt-3 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <span>Backend token verified • Order confirmed immediately</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
