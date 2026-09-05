import React from 'react';
import { ShoppingBag, RefreshCw } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { CustomerNotification } from '../types/notification';

interface StorefrontHeaderProps {
  notifications: CustomerNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onActionClick: (notification: CustomerNotification) => void;
  onOpenCheckout: () => void;
  onResetDemo: () => void;
  cartItemCount: number;
}

export const StorefrontHeader: React.FC<StorefrontHeaderProps> = ({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onActionClick,
  onOpenCheckout,
  onResetDemo,
  cartItemCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-[#E5E5E2] transition-all">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
        
        {/* Brand Logo in Editorial Serif */}
        <div className="flex items-center gap-10">
          <div className="cursor-pointer group">
            <span className="text-2xl sm:text-3xl font-serif italic tracking-tight text-[#1A1A1A]">
              LUMINA
            </span>
            <span className="block text-[9px] uppercase tracking-[0.25em] text-[#9A9A95] font-sans font-medium mt-0.5">
              Acoustics & Studio
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-10 text-xs uppercase tracking-widest text-[#666662]">
            <a href="#studio" className="text-[#1A1A1A] font-semibold border-b border-[#1A1A1A] pb-0.5 transition-colors">
              Studio Series
            </a>
            <a href="#craft" className="hover:text-[#1A1A1A] opacity-75 hover:opacity-100 transition-colors">
              Journal
            </a>
            <a href="#archives" className="hover:text-[#1A1A1A] opacity-75 hover:opacity-100 transition-colors">
              Collections
            </a>
          </nav>
        </div>

        {/* Right Nav Action Controls */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Quick Demo Reset Button */}
          <button
            onClick={onResetDemo}
            title="Reset Demo State"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E5E2] text-[10px] uppercase tracking-widest text-[#666662] hover:text-[#1A1A1A] hover:bg-[#F4F4F1] transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Demo</span>
          </button>

          {/* Customer Notification Bell */}
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={onMarkRead}
            onMarkAllRead={onMarkAllRead}
            onActionClick={onActionClick}
          />

          {/* Editorial Cart / Bag Button */}
          <button
            id="header-cart-btn"
            onClick={onOpenCheckout}
            className="relative inline-flex items-center gap-2.5 px-4 py-2 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs uppercase tracking-widest font-bold transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bag</span>
            <span className="text-[10px] text-[#9A9A95] border-l border-neutral-700 pl-2">
              {cartItemCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
