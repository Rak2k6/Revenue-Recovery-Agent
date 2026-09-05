import React, { useEffect, useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { api } from '../services/api';
import { PaymentFailureScreen } from '../components/PaymentFailureScreen';
import { CustomerNotification } from '../types/notification';

export const PaymentRecoveryPage: React.FC = () => {
  const { params, navigate } = useRouter();
  const orderId = params.orderId || '';
  const [amount, setAmount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('We are confirming your payment.');
  const [notification, setNotification] = useState<CustomerNotification | undefined>();
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    api.getOrder(orderId).then(order => {
      if (active && order) setAmount(order.total);
    });

    const poll = async () => {
      try {
        const status = await api.getPaymentStatus(orderId);
        if (!active) return;

        setStatusMessage(status.message);
        if (status.state === 'PAID') {
          navigate(`/orders/${orderId}`);
          return;
        }

        if (status.state === 'RECOVERY_READY' && status.paymentLinkUrl) {
          setNotification({
            id: `payment-recovery-${orderId}`,
            type: 'PAYMENT_RECOVERY',
            title: 'Complete your payment',
            message: status.message,
            actionLabel: 'Complete Payment',
            actionUrl: status.paymentLinkUrl,
            recoveryLinkUrl: status.paymentLinkUrl,
            state: 'ACTION_REQUIRED',
            read: false,
            createdAt: new Date().toISOString(),
            metadata: { amount, currency: 'INR' },
          });
        }
      } catch {
        if (active) setStatusMessage('We are confirming your payment.');
      } finally {
        if (active) timer = setTimeout(poll, 4000);
      }
    };

    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [amount, navigate, orderId]);

  const openRecovery = (current: CustomerNotification) => {
    if (current.recoveryLinkUrl) window.open(current.recoveryLinkUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      {!notification && (
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          <div className="w-8 h-8 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin mx-auto mb-5" />
          <h1 className="text-2xl font-serif italic text-[#1A1A1A] mb-3">Payment update</h1>
          <p className="text-sm text-[#666662]">{statusMessage}</p>
        </div>
      )}
      {notification && (
        <PaymentFailureScreen
          orderId={orderId}
          amount={amount}
          latestRecoveryNotification={notification}
          onOpenRecovery={openRecovery}
          onRetryOriginal={() => navigate('/checkout')}
          isPolling={isPolling}
        />
      )}
    </>
  );
};