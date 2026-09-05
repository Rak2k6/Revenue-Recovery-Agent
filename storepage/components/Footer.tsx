import React, { useState } from 'react';
import { ShieldCheck, Truck, RotateCcw, Headphones, ArrowRight, Check } from 'lucide-react';
import { useRouter } from '../context/RouterContext';

export const Footer: React.FC = () => {
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && email.includes('@')) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  return (
    <footer className="bg-white border-t border-[#E5E5E2] text-[#1A1A1A]">
      {/* Trust & Guarantee Banner */}
      <div className="border-b border-[#E5E5E2] bg-[#FBFBF9]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-full bg-white border border-[#E5E5E2] flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4 text-[#1A1A1A]" />
              </div>
              <div>
                <h5 className="font-serif italic text-sm text-[#1A1A1A] mb-1">
                  Complimentary Logistics
                </h5>
                <p className="text-xs text-[#666662] leading-relaxed">
                  Free express courier delivery on all orders over ₹999 across India.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-full bg-white border border-[#E5E5E2] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#1A1A1A]" />
              </div>
              <div>
                <h5 className="font-serif italic text-sm text-[#1A1A1A] mb-1">
                  1-Year Studio Warranty
                </h5>
                <p className="text-xs text-[#666662] leading-relaxed">
                  Every product is precision tested and covered with replacement guarantee.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-full bg-white border border-[#E5E5E2] flex items-center justify-center shrink-0">
                <RotateCcw className="w-4 h-4 text-[#1A1A1A]" />
              </div>
              <div>
                <h5 className="font-serif italic text-sm text-[#1A1A1A] mb-1">
                  14-Day Effortless Returns
                </h5>
                <p className="text-xs text-[#666662] leading-relaxed">
                  No questions asked doorstep return pick-up and instant reimbursement.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-full bg-white border border-[#E5E5E2] flex items-center justify-center shrink-0">
                <Headphones className="w-4 h-4 text-[#1A1A1A]" />
              </div>
              <div>
                <h5 className="font-serif italic text-sm text-[#1A1A1A] mb-1">
                  Concierge Support
                </h5>
                <p className="text-xs text-[#666662] leading-relaxed">
                  Direct personal advisory available Monday through Saturday.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Newsletter */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12">
          
          {/* Brand & Newsletter (Col 1-5) */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <span className="text-2xl font-serif italic tracking-tight text-[#1A1A1A] block">
                LUMINA
              </span>
              <span className="text-[9px] uppercase tracking-[0.25em] text-[#9A9A95] font-sans font-medium">
                Studio & Living
              </span>
            </div>

            <p className="text-xs text-[#666662] leading-relaxed max-w-sm font-sans">
              Purveyors of precision acoustics, tactile computing, and refined lifestyle instruments. Built for acoustic purity and daily intention.
            </p>

            {/* Newsletter Subscription */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1A1A1A] block">
                The Lumina Gazette
              </span>
              <p className="text-xs text-[#666662]">
                Subscribe for private edition drops, acoustic essays, and 10% off your initial order.
              </p>

              <form onSubmit={handleSubscribe} className="flex gap-2 max-w-md pt-1">
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-[#FBFBF9] border border-[#E5E5E2] text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#333] text-white text-[11px] uppercase tracking-widest font-bold transition-colors shrink-0 cursor-pointer"
                >
                  Join
                </button>
              </form>

              {subscribed && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 pt-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Welcome to the Lumina private list. Code LUMINA10 sent to inbox.</span>
                </div>
              )}
            </div>
          </div>

          {/* Catalog Columns (Col 6-7) */}
          <div className="lg:col-span-2 space-y-3">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1A1A1A] block mb-2">
              Collections
            </span>
            <ul className="space-y-2 text-xs text-[#666662]">
              <li>
                <button onClick={() => navigate('/shop?category=Audio')} className="hover:text-[#1A1A1A]">
                  Hi-Fi Audio
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/shop?category=Wearables')} className="hover:text-[#1A1A1A]">
                  Smart Wearables
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/shop?category=Computing')} className="hover:text-[#1A1A1A]">
                  Tactile Computing
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/shop?category=Home')} className="hover:text-[#1A1A1A]">
                  Ambient Home
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/shop?category=Accessories')} className="hover:text-[#1A1A1A]">
                  Workspace Accessories
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/shop')} className="hover:text-[#1A1A1A] font-semibold text-[#1A1A1A]">
                  View Entire Catalog →
                </button>
              </li>
            </ul>
          </div>

          {/* Customer Care (Col 8-9) */}
          <div className="lg:col-span-2 space-y-3">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1A1A1A] block mb-2">
              Customer Care
            </span>
            <ul className="space-y-2 text-xs text-[#666662]">
              <li>
                <button onClick={() => navigate('/account')} className="hover:text-[#1A1A1A]">
                  Track Order Status
                </button>
              </li>
              <li>
                <a href="#shipping" className="hover:text-[#1A1A1A]">Shipping & Express Logistics</a>
              </li>
              <li>
                <a href="#returns" className="hover:text-[#1A1A1A]">Returns & Exchanges</a>
              </li>
              <li>
                <a href="#warranty" className="hover:text-[#1A1A1A]">1-Year Studio Warranty</a>
              </li>
              <li>
                <a href="#support" className="hover:text-[#1A1A1A]">Concierge Helpdesk</a>
              </li>
            </ul>
          </div>

          {/* Company & Legals (Col 10-12) */}
          <div className="lg:col-span-3 space-y-3">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1A1A1A] block mb-2">
              Studio Mumbai
            </span>
            <p className="text-xs text-[#666662] leading-relaxed">
              Lumina Acoustics India Private Limited<br />
              402, Sea View Residency, Bandra West<br />
              Mumbai, Maharashtra 400050
            </p>
            <p className="text-xs text-[#666662] pt-1">
              concierge@luminasound.in<br />
              +91 (022) 2640-8800
            </p>
            <div className="pt-2 flex items-center gap-3 text-xs text-[#9A9A95]">
              <span>Instagram</span>
              <span>•</span>
              <span>Twitter / X</span>
              <span>•</span>
              <span>Spotify</span>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Copyright & Security Strip */}
      <div className="border-t border-[#E5E5E2] bg-[#FBFBF9] px-6 sm:px-10 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] uppercase tracking-widest text-[#9A9A95]">
          <div>
            &copy; {new Date().getFullYear()} Lumina Goods India Pvt Ltd. All rights reserved.
          </div>
          <div className="flex items-center space-x-6">
            <a href="#privacy" className="hover:text-[#1A1A1A]">Privacy Policy</a>
            <a href="#terms" className="hover:text-[#1A1A1A]">Terms of Sale</a>
            <a href="#security" className="hover:text-[#1A1A1A]">Security Architecture</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
