import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Clock, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CustomerNotification, NotificationState } from '../types/notification';

interface NotificationBellProps {
  notifications: CustomerNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onActionClick: (notification: CustomerNotification) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onActionClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const formatRelativeTime = (isoString: string): string => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 10) return 'Just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      return `${diffHrs}h ago`;
    } catch {
      return 'Recently';
    }
  };

  const getStateBadge = (state: NotificationState, type: string) => {
    if (state === 'COMPLETED' || type === 'ORDER_CONFIRMED') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-emerald-800">
          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
          Confirmed
        </span>
      );
    }
    if (state === 'ACTION_REQUIRED' || type === 'PAYMENT_RECOVERY') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-[#D44D2F]">
          <span className="w-1.5 h-1.5 bg-[#D44D2F] rounded-full animate-pulse" />
          Action Required
        </span>
      );
    }
    if (type === 'PAYMENT_FAILURE') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-[#D44D2F]">
          <span className="w-1.5 h-1.5 bg-[#D44D2F] rounded-full" />
          Payment Issue
        </span>
      );
    }
    return null;
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications (${unreadCount} unread)`}
        className="relative p-2 text-[#1A1A1A] hover:opacity-70 transition-opacity focus:outline-none"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
        </svg>

        {/* Unread Badge Counter in Editorial Terracotta */}
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-[#D44D2F] text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold shadow-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown Menu in Editorial Palette */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-84 sm:w-96 bg-white border border-[#E5E5E2] shadow-[20px_20px_60px_rgba(0,0,0,0.08)] rounded-sm overflow-hidden z-50 text-[#1A1A1A]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#F0F0EE] flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <span className="font-serif italic text-base text-[#1A1A1A]">Customer Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[9px] bg-[#D44D2F] text-white font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    {unreadCount}
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#9A9A95] hover:text-[#1A1A1A] font-semibold transition-colors"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark Read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-[#F0F0EE]">
              {notifications.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <div className="w-8 h-8 rounded-full bg-[#F4F4F1] text-[#9A9A95] flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-4 h-4" />
                  </div>
                  <p className="text-xs uppercase tracking-widest text-[#9A9A95] font-semibold">No notifications</p>
                  <p className="text-xs text-[#666662] mt-1 font-serif italic">
                    Recovery communications from the backend will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const isActionable =
                    (notification.actionUrl || notification.recoveryLinkUrl) &&
                    notification.actionLabel &&
                    notification.state !== 'COMPLETED';

                  return (
                    <div
                      key={notification.id}
                      className={`p-6 transition-colors ${
                        !notification.read ? 'bg-[#FBFBF9]' : 'bg-white hover:bg-[#FBFBF9]'
                      }`}
                      onClick={() => !notification.read && onMarkRead(notification.id)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        {getStateBadge(notification.state, notification.type)}
                        <span className="text-[10px] uppercase tracking-wider text-[#9A9A95]">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </div>

                      <h5 className="text-base font-serif italic text-[#1A1A1A] mb-1.5 leading-snug">
                        {notification.title}
                      </h5>

                      <p className="text-xs text-[#666662] leading-relaxed mb-4">
                        {notification.message}
                      </p>

                      {/* Action Button: Uses backend returned URL */}
                      {isActionable && (
                        <div className="pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsOpen(false);
                              onActionClick(notification);
                            }}
                            className="w-full bg-[#1A1A1A] hover:bg-[#333] text-white text-center py-2.5 px-4 text-[11px] uppercase tracking-widest font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span>{notification.actionLabel}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-[#FBFBF9] border-t border-[#F0F0EE] text-center">
              <span className="text-[9px] text-[#9A9A95] uppercase tracking-tighter block">
                Direct Synchronized Customer Recovery Stream
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
