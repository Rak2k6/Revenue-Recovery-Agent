import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';

interface ProductHeroProps {
  onBuyNow: () => void;
  price: number;
}

export const ProductHero: React.FC<ProductHeroProps> = ({ onBuyNow, price }) => {
  return (
    <section className="relative overflow-hidden bg-[#FBFBF9] border-b border-[#E5E5E2]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
          
          {/* Left: Product Imagery with Editorial Studio Framing */}
          <div className="lg:col-span-6 bg-[#F4F4F1] p-10 sm:p-16 border-b lg:border-b-0 lg:border-r border-[#E5E5E2] flex flex-col justify-center items-center relative">
            <div className="absolute top-8 left-8">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#9A9A95] font-semibold">
                Edition 01 / Studio
              </span>
            </div>

            <div className="relative max-w-sm w-full aspect-square flex items-center justify-center p-6">
              <img
                src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"
                alt="Aura Studio Hi-Fi Wireless Headphones"
                className="w-full h-full object-contain filter drop-shadow-xl transition-transform duration-700 hover:scale-105"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="w-full flex justify-between items-center text-[10px] uppercase tracking-widest text-[#9A9A95] mt-6 pt-6 border-t border-[#E5E5E2]">
              <span>Handcrafted Beryllium Acoustic</span>
              <span>Matte Obsidian</span>
            </div>
          </div>

          {/* Right: Editorial Typography & Purchase Action */}
          <div className="lg:col-span-6 p-10 sm:p-16 flex flex-col justify-center bg-white">
            <div className="max-w-lg">
              <div className="text-[10px] uppercase tracking-[0.2em] mb-4 text-[#9A9A95] font-semibold">
                Storefront Flagship
              </div>

              <h1 className="text-4xl sm:text-5xl font-serif italic text-[#1A1A1A] leading-[1.1] mb-6">
                Aura Studio Hi-Fi Wireless.
              </h1>

              <p className="text-[#666662] leading-relaxed mb-8 text-sm sm:text-base font-sans">
                Engineered with custom 40mm beryllium drivers, hybrid active noise isolation, and lossless low-latency transmission. Designed for acoustic precision and enduring quietude.
              </p>

              {/* Price Breakdown in Editorial Style */}
              <div className="space-y-4 mb-8">
                <div className="flex justify-between border-b border-[#E5E5E2] pb-3">
                  <span className="text-xs text-[#666662] italic font-serif">Original Master List</span>
                  <span className="text-xs font-medium text-[#9A9A95] line-through">₹4,999.00</span>
                </div>
                <div className="flex justify-between border-b border-[#E5E5E2] pb-3">
                  <span className="text-xs text-[#666662] italic font-serif">Curated Privilege</span>
                  <span className="text-xs font-medium text-emerald-700 font-sans">- ₹2,500.00</span>
                </div>
                <div className="flex justify-between border-b border-[#E5E5E2] pb-3">
                  <span className="text-xs text-[#666662] italic font-serif">Complimentary Logistics</span>
                  <span className="text-xs font-medium text-[#1A1A1A]">₹0.00</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-base font-serif italic text-[#1A1A1A]">Acquisition Total</span>
                  <span className="text-xl font-serif font-semibold text-[#1A1A1A]">₹{price.toLocaleString('en-IN')}.00</span>
                </div>
              </div>

              {/* Editorial CTA Button */}
              <div className="space-y-3">
                <button
                  id="buy-now-btn"
                  onClick={onBuyNow}
                  className="w-full bg-[#1A1A1A] text-white text-center py-4 text-xs uppercase tracking-widest font-bold hover:bg-[#333] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Checkout Now • ₹{price.toLocaleString('en-IN')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#9A9A95] pt-1">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-[#1A1A1A]" />
                    Razorpay Secure Pipeline
                  </span>
                  <span>Backend Recovery Guard Active</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
