import React, { useState } from 'react';
import {
  ShieldCheck,
  Truck,
  CreditCard,
  Smartphone,
  Building2,
  Lock,
  ArrowRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import { DeliveryMethod, PaymentMethodType, Order } from '../types/order';

const DELIVERY_OPTIONS: DeliveryMethod[] = [
  {
    id: 'standard',
    name: 'Standard Logistics Delivery',
    description: 'Delivered in 3–5 Business Days via Surface Express',
    price: 0,
    estimatedDeliveryDays: '3–5 days',
  },
  {
    id: 'express',
    name: 'Priority Air Express Logistics',
    description: 'Guaranteed 1–2 Business Days dispatch with real-time tracking',
    price: 150,
    estimatedDeliveryDays: '1–2 days',
  },
];

export const CheckoutPage: React.FC = () => {
  const { navigate } = useRouter();
  const { items, subtotal, total: cartTotal, clearCart, promoCode, appliedPromoDiscount } = useCart();

  const [fullName, setFullName] = useState('Rahul Sharma');
  const [email, setEmail] = useState('rahul.sharma@example.com');
  const [phone, setPhone] = useState('+91 98765 43210');

  const [street, setStreet] = useState('402, Sea View Residency, Bandra West');
  const [apartment, setApartment] = useState('Flat 402, Wing B');
  const [city, setCity] = useState('Mumbai');
  const [stateName, setStateName] = useState('Maharashtra');
  const [pincode, setPincode] = useState('400050');

  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryMethod>(DELIVERY_OPTIONS[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('upi');

  const [upiId, setUpiId] = useState('rahul@okaxis');
  const [cardNumber, setCardNumber] = useState('•••• •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('•••');

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deliveryFee = selectedDelivery.price;
  const finalPayableTotal = Math.max(0, subtotal - appliedPromoDiscount + deliveryFee);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim() || !email.trim() || !street.trim() || !pincode.trim()) {
      setErrorMessage('Please complete all required contact and delivery fields.');
      return;
    }

    setIsProcessing(true);

    try {
      const createdOrder = await api.createOrder({
        items,
        subtotal,
        discount: appliedPromoDiscount,
        deliveryFee,
        total: finalPayableTotal,
        customerInfo: {
          fullName,
          email,
          phone,
        },
        shippingAddress: {
          street,
          apartment,
          city,
          state: stateName,
          pincode,
          country: 'India',
        },
        deliveryMethod: selectedDelivery,
        paymentMethod,
      });

      clearCart();
      if (!createdOrder.id) throw new Error('Payment order was not created.');

      const razorpayOptions = {
        key: createdOrder.razorpayKeyId || '',
        amount: Math.round(finalPayableTotal * 100),
        currency: 'INR',
        name: 'Lumina Goods',
        description: 'Customer order payment',
        order_id: createdOrder.id,
        prefill: { name: fullName, email, contact: phone },
        handler: () => navigate(`/payment-status/${createdOrder.id}`),
        modal: { ondismiss: () => setIsProcessing(false) },
      };

      if (!razorpayOptions.key) {
        throw new Error('Payment checkout is not configured.');
      }

      const razorpay = await loadRazorpay(razorpayOptions);
      razorpay.on?.('payment.failed', (response: any) => {
        navigate(`/payment-failed/${response?.error?.metadata?.order_id || createdOrder.id}`);
      });
      razorpay.open();
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err?.message || 'Payment processing error. Please retry.');
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-serif italic text-[#1A1A1A] mb-4">
          No Items to Checkout
        </h2>
        <button
          onClick={() => navigate('/shop')}
          className="px-6 py-3 bg-[#1A1A1A] text-white text-xs uppercase tracking-widest font-bold"
        >
          Explore Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      
      {/* Header */}
      <div className="border-b border-[#E5E5E2] pb-6 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#9A9A95] block mb-1">
            Secure Transaction
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif italic text-[#1A1A1A]">
            Checkout & Delivery
          </h1>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#9A9A95]">
          <Lock className="w-3.5 h-3.5 text-emerald-700" />
          <span>256-Bit SSL Encrypted</span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form Grid */}
      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* Left Form (Cols 1-7) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* 1. Customer Information */}
          <div className="bg-white border border-[#E5E5E2] p-6 space-y-4">
            <h3 className="font-serif italic text-lg text-[#1A1A1A] flex items-center gap-2 pb-3 border-b border-[#F0F0EE]">
              <span className="w-5 h-5 rounded-full bg-[#1A1A1A] text-white text-[10px] flex items-center justify-center font-sans font-bold">
                1
              </span>
              <span>Customer Contact Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FBFBF9] border border-[#E5E5E2] text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FBFBF9] border border-[#E5E5E2] text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] mb-1">
                  Mobile Contact *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FBFBF9] border border-[#E5E5E2] text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>
            </div>
          </div>

          {/* 2. Shipping Address */}
          <div className="bg-white border border-[#E5E5E2] p-6 space-y-4">
            <h3 className="font-serif italic text-lg text-[#1A1A1A] flex items-center gap-2 pb-3 border-b border-[#F0F0EE]">
              <span className="w-5 h-5 rounded-full bg-[#1A1A1A] text-white text-[10px] flex items-center justify-center font-sans font-bold">
                2
              </span>
              <span>Delivery Address</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] mb-1">
                  Street Address & Colony *
                </label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={e => setStreet(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FBFBF9] border border-[#E5E5E2] text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] mb-1">
                  Apartment, Suite, Unit (Optional)
                </label>
                <input
                  type="text"
                  value={apartment}
                  onChange={e => setApartment(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FBFBF9] border border-[#E5E5E2] text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] mb-1">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FBFBF9] border border-[#E5E5E2] text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] mb-1">
                  State *
                </label>
                <input
                  type="text"
                  required
                  value={stateName}
                  onChange={e => setStateName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FBFBF9] border border-[#E5E5E2] text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] mb-1">
                  Postal Pincode *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={pincode}
                  onChange={e => setPincode(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FBFBF9] border border-[#E5E5E2] text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] mb-1">
                  Country
                </label>
                <input
                  type="text"
                  disabled
                  value="India"
                  className="w-full px-3 py-2.5 bg-[#F4F4F1] border border-[#E5E5E2] text-xs text-[#9A9A95]"
                />
              </div>
            </div>
          </div>

          {/* 3. Delivery Method */}
          <div className="bg-white border border-[#E5E5E2] p-6 space-y-4">
            <h3 className="font-serif italic text-lg text-[#1A1A1A] flex items-center gap-2 pb-3 border-b border-[#F0F0EE]">
              <span className="w-5 h-5 rounded-full bg-[#1A1A1A] text-white text-[10px] flex items-center justify-center font-sans font-bold">
                3
              </span>
              <span>Delivery Method</span>
            </h3>

            <div className="space-y-3">
              {DELIVERY_OPTIONS.map(opt => (
                <label
                  key={opt.id}
                  onClick={() => setSelectedDelivery(opt)}
                  className={`p-4 border block cursor-pointer transition-all ${
                    selectedDelivery.id === opt.id
                      ? 'border-[#1A1A1A] bg-[#FBFBF9]'
                      : 'border-[#E5E5E2] bg-white hover:border-[#9A9A95]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="deliveryMethod"
                        checked={selectedDelivery.id === opt.id}
                        onChange={() => setSelectedDelivery(opt)}
                        className="accent-[#1A1A1A]"
                      />
                      <div>
                        <span className="font-serif italic text-sm text-[#1A1A1A] font-semibold block">
                          {opt.name}
                        </span>
                        <span className="text-xs text-[#666662] block">
                          {opt.description}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold font-sans text-[#1A1A1A]">
                      {opt.price === 0 ? 'FREE' : `+₹${opt.price}`}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 4. Payment Method */}
          <div className="bg-white border border-[#E5E5E2] p-6 space-y-4">
            <h3 className="font-serif italic text-lg text-[#1A1A1A] flex items-center gap-2 pb-3 border-b border-[#F0F0EE]">
              <span className="w-5 h-5 rounded-full bg-[#1A1A1A] text-white text-[10px] flex items-center justify-center font-sans font-bold">
                4
              </span>
              <span>Payment Option</span>
            </h3>

            {/* Payment method selector tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'upi', name: 'Instant UPI', icon: Smartphone },
                { id: 'card', name: 'Card', icon: CreditCard },
                { id: 'netbanking', name: 'Net Banking', icon: Building2 },
                { id: 'wallet', name: 'Wallet', icon: Smartphone },
              ].map(method => {
                const Icon = method.icon;
                const isSelected = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id as any)}
                    className={`p-3 border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      isSelected
                        ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                        : 'border-[#E5E5E2] bg-white text-[#666662] hover:border-[#1A1A1A]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      {method.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Payment Details Fields */}
            <div className="p-4 bg-[#FBFBF9] border border-[#E5E5E2] text-xs space-y-3">
              {paymentMethod === 'upi' && (
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95]">
                    Virtual Payment Address (UPI ID)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={e => setUpiId(e.target.value)}
                    placeholder="username@okhdfcbank"
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E2] text-xs"
                  />
                  <p className="text-[11px] text-[#9A9A95]">
                    Google Pay, PhonePe, Paytm, or BHIM request will be prompted directly.
                  </p>
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={e => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E2] text-xs font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] mb-1">
                        Expiry (MM/YY)
                      </label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={e => setCardExpiry(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#E5E5E2] text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] mb-1">
                        CVV / CVC
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#E5E5E2] text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'netbanking' && (
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95]">
                    Select Bank Portal
                  </label>
                  <select className="w-full px-3 py-2 bg-white border border-[#E5E5E2] text-xs">
                    <option>HDFC Bank Corporate / Retail</option>
                    <option>ICICI Bank Internet Banking</option>
                    <option>State Bank of India</option>
                    <option>Axis Bank</option>
                    <option>Kotak Mahindra Bank</option>
                  </select>
                </div>
              )}

              {paymentMethod === 'wallet' && (
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-[#9A9A95]">
                    Select Digital Wallet
                  </label>
                  <select className="w-full px-3 py-2 bg-white border border-[#E5E5E2] text-xs">
                    <option>Paytm Wallet</option>
                    <option>Amazon Pay</option>
                    <option>MobiKwik</option>
                  </select>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Order Review & Place Order CTA (Cols 8-12) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#E5E5E2] p-6 sm:p-8 space-y-6 sticky top-28">
            <h3 className="font-serif italic text-xl text-[#1A1A1A] pb-3 border-b border-[#E5E5E2]">
              Review Order ({items.length} items)
            </h3>

            {/* Purchased Items Preview */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1 divide-y divide-[#F0F0EE]">
              {items.map(item => (
                <div key={item.id} className="pt-3 first:pt-0 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.product.thumbnail}
                      alt={item.product.name}
                      className="w-10 h-10 object-contain bg-[#F4F4F1] border border-[#E5E5E2] p-1 shrink-0"
                    />
                    <div>
                      <span className="font-serif italic text-[#1A1A1A] block line-clamp-1">
                        {item.product.name}
                      </span>
                      <span className="text-[10px] text-[#9A9A95]">
                        Qty: {item.quantity} {item.selectedVariant ? `• ${item.selectedVariant.name}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="font-sans font-bold text-[#1A1A1A] shrink-0">
                    ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            {/* Calculations Breakdown */}
            <div className="pt-4 border-t border-[#E5E5E2] space-y-2.5 text-xs text-[#666662]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-sans font-semibold text-[#1A1A1A]">
                  ₹{subtotal.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Delivery ({selectedDelivery.name})</span>
                <span>
                  {deliveryFee === 0 ? (
                    <span className="text-emerald-700 font-bold text-[10px] uppercase">
                      FREE
                    </span>
                  ) : (
                    `₹${deliveryFee}`
                  )}
                </span>
              </div>

              {appliedPromoDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Promotional Voucher ({promoCode})</span>
                  <span>-₹{appliedPromoDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="pt-4 border-t border-[#E5E5E2] flex justify-between items-baseline">
                <span className="font-serif italic text-base text-[#1A1A1A]">
                  Total Payable
                </span>
                <span className="text-2xl font-bold font-sans text-[#1A1A1A]">
                  ₹{finalPayableTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Place Order Action Button */}
            <button
              type="submit"
              id="checkout-submit-btn"
              disabled={isProcessing}
              className="w-full py-4 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs uppercase tracking-widest font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isProcessing ? (
                <span>Confirming Order...</span>
              ) : (
                <>
                  <span>Complete Order • ₹{finalPayableTotal.toLocaleString('en-IN')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-[#9A9A95] pt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Certified Secure Checkout</span>
            </div>

          </div>
        </div>

      </form>

    </div>
  );
};

async function loadRazorpay(options: Record<string, unknown>): Promise<any> {
  const RazorpayConstructor = window.Razorpay;
  if (RazorpayConstructor) return new RazorpayConstructor(options);

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load secure payment checkout.'));
    document.body.appendChild(script);
  });

  const LoadedRazorpay = window.Razorpay;
  if (!LoadedRazorpay) throw new Error('Secure payment checkout is unavailable.');
  return new LoadedRazorpay(options);
}
