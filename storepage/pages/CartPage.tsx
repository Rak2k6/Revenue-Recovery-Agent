import React, { useState } from 'react';
import {
  ShoppingBag,
  Trash2,
  Heart,
  ArrowRight,
  ShieldCheck,
  Tag,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export const CartPage: React.FC = () => {
  const { navigate } = useRouter();
  const {
    items,
    updateQuantity,
    removeFromCart,
    subtotal,
    deliveryFee,
    total,
    promoCode,
    applyPromoCode,
    removePromoCode,
    appliedPromoDiscount,
  } = useCart();
  const { toggleWishlist } = useWishlist();

  const [inputCoupon, setInputCoupon] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCoupon.trim()) return;
    const res = applyPromoCode(inputCoupon);
    setCouponFeedback(res);
    if (res.success) {
      setInputCoupon('');
    }
  };

  const handleMoveToWishlist = (itemId: string, productId: string) => {
    toggleWishlist(productId);
    removeFromCart(itemId);
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-20 text-center">
        <div className="max-w-md mx-auto bg-white border border-[#E5E5E2] p-12 space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#F4F4F1] flex items-center justify-center mx-auto text-[#9A9A95]">
            <ShoppingBag className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-serif italic text-[#1A1A1A] mb-2">
              Your Shopping Bag is Empty
            </h2>
            <p className="text-xs text-[#666662] leading-relaxed">
              Explore our curated selection of acoustic instruments, tactile keyboards, and studio essentials.
            </p>
          </div>

          <button
            onClick={() => navigate('/shop')}
            className="w-full py-4 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs uppercase tracking-widest font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Discover Collection</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      
      {/* Page Header */}
      <div className="border-b border-[#E5E5E2] pb-6">
        <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#9A9A95] block mb-1">
          Review Selection
        </span>
        <h1 className="text-3xl sm:text-4xl font-serif italic text-[#1A1A1A]">
          Shopping Bag ({items.reduce((s, i) => s + i.quantity, 0)} items)
        </h1>
      </div>

      {/* Grid: Cart Items (Cols 1-8) + Order Summary (Cols 9-12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* Cart Item Rows */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-[#E5E5E2] divide-y divide-[#F0F0EE]">
            {items.map(item => (
              <div
                key={item.id}
                className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* Thumbnail & Title */}
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => navigate(`/products/${item.product.id}`)}
                    className="w-20 h-20 bg-[#F4F4F1] border border-[#E5E5E2] p-2 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <img
                      src={item.product.thumbnail}
                      alt={item.product.name}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[#9A9A95] block">
                      {item.product.category}
                    </span>
                    <h3
                      onClick={() => navigate(`/products/${item.product.id}`)}
                      className="font-serif italic text-base sm:text-lg text-[#1A1A1A] hover:text-[#D44D2F] cursor-pointer"
                    >
                      {item.product.name}
                    </h3>

                    {item.selectedVariant && (
                      <span className="text-xs text-[#666662] block mt-0.5">
                        Variant: {item.selectedVariant.name}
                      </span>
                    )}

                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <button
                        onClick={() => handleMoveToWishlist(item.id, item.product.id)}
                        className="text-[#666662] hover:text-[#1A1A1A] flex items-center gap-1 cursor-pointer"
                      >
                        <Heart className="w-3.5 h-3.5" />
                        <span>Move to Wishlist</span>
                      </button>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-[#D44D2F] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quantity Controls & Price */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F0F0EE]">
                  <div className="text-right">
                    <span className="font-sans font-bold text-base text-[#1A1A1A]">
                      ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                    </span>
                    {item.quantity > 1 && (
                      <span className="text-[10px] text-[#9A9A95] block">
                        ₹{item.product.price.toLocaleString('en-IN')} each
                      </span>
                    )}
                  </div>

                  {/* Quantity adjustment buttons */}
                  <div className="flex items-center border border-[#E5E5E2] bg-white">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="px-2.5 py-1 text-xs text-[#1A1A1A] hover:bg-[#F4F4F1] font-bold"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 text-xs font-bold text-[#1A1A1A] min-w-8 text-center font-sans">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-2.5 py-1 text-xs text-[#1A1A1A] hover:bg-[#F4F4F1] font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => navigate('/shop')}
              className="text-xs uppercase tracking-wider font-bold text-[#1A1A1A] hover:text-[#D44D2F] flex items-center gap-1.5 cursor-pointer"
            >
              <span>← Continue Shopping</span>
            </button>
          </div>
        </div>

        {/* Order Summary Card (Cols 9-12) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-[#E5E5E2] p-6 sm:p-8 space-y-6">
            <h3 className="font-serif italic text-xl text-[#1A1A1A] pb-4 border-b border-[#E5E5E2]">
              Order Summary
            </h3>

            {/* Calculations Breakdown */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-[#666662]">
                <span>Items Subtotal</span>
                <span className="font-sans font-semibold text-[#1A1A1A]">
                  ₹{subtotal.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between text-[#666662]">
                <span>Estimated Express Delivery</span>
                <span>
                  {deliveryFee === 0 ? (
                    <span className="text-emerald-700 font-bold uppercase tracking-wider text-[10px]">
                      FREE
                    </span>
                  ) : (
                    <span className="font-sans font-semibold text-[#1A1A1A]">₹{deliveryFee}</span>
                  )}
                </span>
              </div>

              {appliedPromoDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Promotional Discount ({promoCode})</span>
                  <span>-₹{appliedPromoDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="pt-4 border-t border-[#E5E5E2] flex justify-between items-baseline">
                <span className="font-serif italic text-base text-[#1A1A1A]">
                  Estimated Total
                </span>
                <div className="text-right">
                  <span className="text-2xl font-bold font-sans text-[#1A1A1A] block">
                    ₹{total.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-[#9A9A95]">Inclusive of all applicable taxes</span>
                </div>
              </div>
            </div>

            {/* Promo Code Coupon Box */}
            <div className="pt-4 border-t border-[#F0F0EE] space-y-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <span>Promotional Voucher</span>
              </span>

              {promoCode ? (
                <div className="p-3 bg-[#F4F4F1] border border-emerald-300 flex items-center justify-between text-xs text-emerald-800">
                  <span className="font-bold uppercase tracking-wider">
                    {promoCode} applied (-₹{appliedPromoDiscount})
                  </span>
                  <button
                    onClick={removePromoCode}
                    className="text-[#D44D2F] font-semibold text-[11px] hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. LUMINA10"
                    value={inputCoupon}
                    onChange={e => setInputCoupon(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#FBFBF9] border border-[#E5E5E2] text-xs text-[#1A1A1A] uppercase focus:outline-none focus:border-[#1A1A1A]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs uppercase tracking-wider font-bold transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </form>
              )}

              {couponFeedback && !promoCode && (
                <p
                  className={`text-xs ${
                    couponFeedback.success ? 'text-emerald-700' : 'text-[#D44D2F]'
                  }`}
                >
                  {couponFeedback.message}
                </p>
              )}
            </div>

            {/* Checkout CTA */}
            <button
              id="proceed-to-checkout-btn"
              onClick={() => navigate('/checkout')}
              className="w-full py-4 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs uppercase tracking-widest font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Assurances */}
            <div className="pt-2 text-[11px] text-[#9A9A95] space-y-2 border-t border-[#F0F0EE]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <span>100% Genuine Studio Equipment Guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <span>14-Day Free Doorstep Return & Exchange</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
