import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { CustomerNotification } from '../types/notification';

interface NotificationToastProps {
  notification: CustomerNotification | null;
  onClose: () => void;
  onActionClick: (notification: CustomerNotification) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onActionClick,
}) => {
  if (!notification) return null;

  const isRecovery = notification.type === 'PAYMENT_RECOVERY' || notification.state === 'ACTION_REQUIRED';
  const isConfirmed = notification.type === 'ORDER_CONFIRMED' || notification.state === 'COMPLETED';

  return (
    <AnimatePresence>
      <div className="fixed bottom-8 right-8 z-50 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto w-full bg-white shadow-[20px_20px_60px_rgba(0,0,0,0.08)] rounded-sm border border-[#E5E5E2] overflow-hidden"
          role="alert"
          aria-live="assertive"
        >
          {/* Top Header Strip */}
          <div className="px-6 py-4 border-b border-[#F0F0EE] flex justify-between items-center bg-white">
            <span
              className={`text-[10px] uppercase tracking-widest font-bold flex items-center ${
                isRecovery
                  ? 'text-[#D44D2F]'
                  : isConfirmed
                  ? 'text-emerald-700'
                  : 'text-[#1A1A1A]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-2 ${
                  isRecovery ? 'bg-[#D44D2F] animate-pulse' : isConfirmed ? 'bg-emerald-600' : 'bg-[#1A1A1A]'
                }`}
              />
              {isRecovery ? 'Action Required' : isConfirmed ? 'Confirmed' : 'Notification'}
            </span>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-[#9A9A95]">Just now</span>
              <button
                onClick={onClose}
                className="text-[#9A9A95] hover:text-[#1A1A1A] transition-colors p-0.5"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Editorial Content */}
          <div className="p-6 sm:p-7">
            <h3 className="text-lg font-serif italic text-[#1A1A1A] mb-2 leading-snug">
              {notification.title}
            </h3>
            <p className="text-xs sm:text-sm text-[#666662] leading-relaxed mb-6 font-sans">
              {notification.message}
            </p>

            {/* Complete Payment / Direct Action Button */}
            {(notification.actionUrl || notification.recoveryLinkUrl) && notification.actionLabel && (
              <div className="space-y-2">
                <button
                  onClick={() => onActionClick(notification)}
                  className="block w-full bg-[#1A1A1A] text-white text-center py-3.5 text-xs uppercase tracking-widest font-bold hover:bg-[#333] transition-colors cursor-pointer"
                >
                  {notification.actionLabel}
                </button>
                <button
                  onClick={onClose}
                  className="w-full text-center text-[10px] uppercase tracking-widest text-[#9A9A95] hover:text-[#1A1A1A] py-1 transition-colors"
                >
                  Review Later
                </button>
              </div>
            )}
          </div>

          {/* Security strip matching design */}
          <div className="px-6 py-3 bg-[#FBFBF9] border-t border-[#F0F0EE]">
            <p className="text-[9px] text-[#9A9A95] leading-normal uppercase tracking-tighter">
              Transaction Security: Powered by Razorpay Secure Pipeline
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
