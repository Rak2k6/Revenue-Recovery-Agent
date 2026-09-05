import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  Truck,
  PackageCheck,
  Calendar,
  MapPin,
  ArrowRight,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { api } from '../services/api';
import { Order } from '../types/order';

export const OrderConfirmationPage: React.FC = () => {
  const { params, navigate } = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const orderId = params.orderId || 'ORD-104921';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    let active = true;
    Promise.all([api.getOrder(orderId), api.getPaymentStatus(orderId)])
      .then(([ord, status]) => {
        if (!active) return;
        if (status.state !== 'PAID') {
          navigate(`/payment-status/${orderId}`);
          return;
        }
        setOrder(ord);
        setLoading(false);
      })
      .catch(() => {
        if (active) navigate(`/payment-status/${orderId}`);
      });
    return () => { active = false; };
  }, [navigate, orderId]);

  if (loading || !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="w-8 h-8 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs text-[#9A9A95] font-serif italic">Retrieving order details...</p>
      </div>
    );
  }

  const steps = [
    { label: 'Order Confirmed', completed: true, date: 'Today' },
    { label: 'Preparing in Studio', completed: true, date: 'Today' },
    { label: 'Dispatched with Courier', completed: order.status === 'SHIPPED' || order.status === 'DELIVERED', date: 'Expected Tomorrow' },
    { label: 'Delivered to Doorstep', completed: order.status === 'DELIVERED', date: order.estimatedDeliveryDate },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 sm:py-16 space-y-10">
      
      {/* Header Confirmation Celebration */}
      <div className="bg-white border border-[#E5E5E2] p-8 sm:p-12 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
          <CheckCircle className="w-7 h-7" />
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-emerald-800 block mb-1">
            Payment Completed Successfully
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif italic text-[#1A1A1A]">
            Thank You for Your Order
          </h1>
          <p className="text-xs text-[#666662] max-w-md mx-auto mt-2 leading-relaxed font-sans">
            A confirmation email and tax invoice have been dispatched to{' '}
            <strong className="text-[#1A1A1A]">{order.customerInfo.email}</strong>.
          </p>
        </div>

        <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-[#666662] border-t border-[#F0F0EE]">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#9A9A95] block">
              Order Number
            </span>
            <span className="font-mono font-bold text-[#1A1A1A] text-sm">{order.orderNumber}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#9A9A95] block">
              Estimated Delivery
            </span>
            <span className="font-semibold text-[#1A1A1A]">{order.estimatedDeliveryDate}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#9A9A95] block">
              Payment Method
            </span>
            <span className="font-semibold text-[#1A1A1A] uppercase">{order.paymentMethod}</span>
          </div>
        </div>
      </div>

      {/* Visual Tracking Progress Timeline */}
      <div className="bg-white border border-[#E5E5E2] p-6 sm:p-8 space-y-6">
        <h3 className="font-serif italic text-lg text-[#1A1A1A]">
          Fulfillment Timeline
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {steps.map((step, idx) => (
            <div key={idx} className="relative flex flex-col items-center text-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center mb-2 font-bold text-xs ${
                  step.completed
                    ? 'bg-[#1A1A1A] text-white'
                    : 'bg-[#F4F4F1] text-[#9A9A95] border border-[#E5E5E2]'
                }`}
              >
                {idx + 1}
              </div>
              <span className="font-serif italic text-xs text-[#1A1A1A] font-semibold block">
                {step.label}
              </span>
              <span className="text-[10px] text-[#9A9A95]">{step.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Purchased Items & Delivery Destination Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Purchased Items (Cols 1-7) */}
        <div className="md:col-span-7 bg-white border border-[#E5E5E2] p-6 space-y-4">
          <h3 className="font-serif italic text-lg text-[#1A1A1A] pb-3 border-b border-[#F0F0EE]">
            Instruments in this Order
          </h3>

          <div className="divide-y divide-[#F0F0EE]">
            {order.items.map(item => (
              <div key={item.id} className="py-3.5 first:pt-0 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <img
                    src={item.product.thumbnail}
                    alt={item.product.name}
                    className="w-12 h-12 object-contain bg-[#F4F4F1] border border-[#E5E5E2] p-1 shrink-0"
                  />
                  <div>
                    <h4 className="font-serif italic text-[#1A1A1A] text-sm">
                      {item.product.name}
                    </h4>
                    {item.selectedVariant && (
                      <span className="text-[11px] text-[#9A9A95] block">
                        Variant: {item.selectedVariant.name}
                      </span>
                    )}
                    <span className="text-[11px] text-[#666662]">
                      Qty: {item.quantity} × ₹{item.product.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <span className="font-sans font-bold text-[#1A1A1A]">
                  ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>

          {/* Breakdown Totals */}
          <div className="pt-4 border-t border-[#E5E5E2] space-y-2 text-xs text-[#666662]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-sans font-semibold text-[#1A1A1A]">
                ₹{order.subtotal.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Logistics ({order.deliveryMethod.name})</span>
              <span>{order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Voucher Discount</span>
                <span>-₹{order.discount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="pt-3 border-t border-[#E5E5E2] flex justify-between items-baseline font-bold">
              <span className="font-serif italic text-base text-[#1A1A1A]">Total Paid</span>
              <span className="text-xl font-sans text-[#1A1A1A]">
                ₹{order.total.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Shipping Destination & Contact Details (Cols 8-12) */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-white border border-[#E5E5E2] p-6 space-y-4">
            <h3 className="font-serif italic text-lg text-[#1A1A1A] pb-3 border-b border-[#F0F0EE]">
              Delivery Destination
            </h3>

            <div className="text-xs space-y-3 text-[#666662]">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#1A1A1A] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#1A1A1A] block">{order.customerInfo.fullName}</strong>
                  <span>{order.shippingAddress.street}</span><br />
                  {order.shippingAddress.apartment && (
                    <><span>{order.shippingAddress.apartment}</span><br /></>
                  )}
                  <span>{order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}</span><br />
                  <span>{order.shippingAddress.country}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#F0F0EE]">
                <span className="text-[10px] uppercase tracking-wider text-[#9A9A95] block">
                  Contact Phone
                </span>
                <span className="text-[#1A1A1A]">{order.customerInfo.phone}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#9A9A95] block">
                  Carrier Tracking Code
                </span>
                <span className="font-mono text-[#1A1A1A] font-semibold">{order.trackingNumber}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/shop')}
              className="w-full py-3.5 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs uppercase tracking-widest font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Continue Shopping</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigate('/account')}
              className="w-full py-3 border border-[#E5E5E2] hover:border-[#1A1A1A] bg-white text-xs uppercase tracking-widest font-bold text-[#1A1A1A] transition-colors cursor-pointer"
            >
              <span>View All Past Orders</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
