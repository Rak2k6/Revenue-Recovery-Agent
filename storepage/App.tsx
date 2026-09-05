import React, { useState, useEffect } from 'react';
import { RouterProvider, useRouter } from './context/RouterContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { AccountPage } from './pages/AccountPage';
import { PaymentRecoveryPage } from './pages/PaymentRecoveryPage';

import { NotificationToast } from './components/NotificationToast';
import { RecoveryPaymentModal } from './components/RecoveryPaymentModal';
import { notificationService } from './services/notificationService';
import { CustomerNotification } from './types/notification';

function MainAppContent() {
  const { currentPath, navigate, params } = useRouter();

  // Backend Notifications State
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeRecoveryNotification, setActiveRecoveryNotification] = useState<CustomerNotification | null>(null);
  const [toastNotification, setToastNotification] = useState<CustomerNotification | null>(null);

  // Subscribe to backend customer notification stream / polling
  useEffect(() => {
    const unsubscribe = notificationService.subscribe((updatedNotifications, unread, latestArrival) => {
      setNotifications(updatedNotifications);
      setUnreadCount(unread);

      // If backend reports a new payment failure or recovery event, trigger the customer toast
      if (latestArrival && (!latestArrival.read || latestArrival.state === 'ACTION_REQUIRED')) {
        setToastNotification(latestArrival);
      }
    });

    notificationService.startPolling();

    return () => {
      unsubscribe();
      notificationService.stopPolling();
    };
  }, []);

  // When customer clicks "Complete Payment" or an action in toast/bell
  const handleActionClick = (notification: CustomerNotification) => {
    if (notification.type === 'PAYMENT_RECOVERY' || notification.state === 'ACTION_REQUIRED') {
      setActiveRecoveryNotification(notification);
      notificationService.markNotificationRead(notification.id);
      setToastNotification(null);
    } else if (notification.type === 'ORDER_CONFIRMED' || notification.metadata?.orderId) {
      const targetOrder = notification.metadata?.orderId || 'ORD-104921';
      navigate(`/orders/${targetOrder}`);
      notificationService.markNotificationRead(notification.id);
      setToastNotification(null);
    } else if (notification.actionUrl) {
      navigate(notification.actionUrl);
      notificationService.markNotificationRead(notification.id);
      setToastNotification(null);
    }
  };

  const handleCompleteRecovery = async () => {
    const recoveryUrl = activeRecoveryNotification?.recoveryLinkUrl || activeRecoveryNotification?.actionUrl;
    if (recoveryUrl) window.open(recoveryUrl, '_blank', 'noopener,noreferrer');
  };

  // Mark notification read
  const handleMarkRead = (id: string) => {
    notificationService.markNotificationRead(id);
  };

  // Mark all notifications read
  const handleMarkAllRead = () => {
    notificationService.markAllRead();
  };

  // Route selector
  const renderCurrentPage = () => {
    const path = params.path;

    if (path === '/' || path === '') {
      return <HomePage />;
    }
    if (path === '/shop') {
      return <ShopPage />;
    }
    if (path.startsWith('/products/')) {
      return <ProductDetailsPage />;
    }
    if (path === '/cart') {
      return <CartPage />;
    }
    if (path === '/checkout') {
      return <CheckoutPage />;
    }
    if (path.startsWith('/payment-status/') || path.startsWith('/payment-failed/')) {
      return <PaymentRecoveryPage />;
    }
    if (path.startsWith('/orders/') || path.startsWith('/order/')) {
      return <OrderConfirmationPage />;
    }
    if (path === '/account') {
      return <AccountPage />;
    }

    // Default fallback
    return <HomePage />;
  };

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-[#1A1A1A] flex flex-col font-sans antialiased selection:bg-[#E5E5E2] selection:text-[#1A1A1A]">
      {/* Storefront Navigation Bar */}
      <Navbar
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onActionClick={handleActionClick}
      />

      {/* Main Page Content */}
      <main className="flex-1">
        {renderCurrentPage()}
      </main>

      {/* Full E-commerce Footer */}
      <Footer />

      {/* Non-intrusive In-App Toast for backend-triggered notifications */}
      <NotificationToast
        notification={toastNotification}
        onClose={() => {
          if (toastNotification) {
            handleMarkRead(toastNotification.id);
          }
          setToastNotification(null);
        }}
        onActionClick={handleActionClick}
      />

      {/* Backend Recovery Payment Modal */}
      <RecoveryPaymentModal
        isOpen={!!activeRecoveryNotification}
        notification={activeRecoveryNotification}
        onClose={() => setActiveRecoveryNotification(null)}
        onCompleteRecovery={handleCompleteRecovery}
        amount={activeRecoveryNotification?.metadata?.amount || 2499}
      />
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <CartProvider>
        <WishlistProvider>
          <MainAppContent />
        </WishlistProvider>
      </CartProvider>
    </RouterProvider>
  );
}
