import React from 'react';
import { ArrowRight, Sparkles, Star, ShieldCheck, ChevronRight } from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { MOCK_PRODUCTS } from '../data/products';
import { ProductCard } from '../components/ProductCard';

const CATEGORY_CARDS = [
  {
    name: 'Hi-Fi Audio',
    category: 'Audio',
    image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80',
    count: '6 Products',
  },
  {
    name: 'Wearables',
    category: 'Wearables',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    count: '4 Products',
  },
  {
    name: 'Computing',
    category: 'Computing',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
    count: '5 Products',
  },
  {
    name: 'Ambient Home',
    category: 'Home',
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80',
    count: '3 Products',
  },
  {
    name: 'Accessories',
    category: 'Accessories',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80',
    count: '7 Products',
  },
  {
    name: 'Lifestyle',
    category: 'Lifestyle',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
    count: '5 Products',
  },
];

export const HomePage: React.FC = () => {
  const { navigate } = useRouter();

  const featuredProducts = MOCK_PRODUCTS.filter(p => p.isFeatured).slice(0, 4);
  const trendingProducts = MOCK_PRODUCTS.filter(p => p.isTrending).slice(0, 4);

  return (
    <div className="space-y-16 sm:space-y-24">
      
      {/* 1. Hero Section */}
      <section className="relative bg-[#FBFBF9] border-b border-[#E5E5E2] overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[580px] sm:min-h-[640px]">
          
          {/* Left Text & Call to Action */}
          <div className="lg:col-span-7 p-8 sm:p-14 lg:p-20 flex flex-col justify-center bg-white border-b lg:border-b-0 lg:border-r border-[#E5E5E2]">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F4F4F1] border border-[#E5E5E2] text-[10px] uppercase tracking-[0.25em] font-semibold text-[#1A1A1A] mb-6">
                <Sparkles className="w-3 h-3 text-[#D44D2F]" />
                <span>Autumn Studio 2026 Collection</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif italic text-[#1A1A1A] leading-[1.08] tracking-tight mb-6">
                Upgrade Your Everyday.
              </h1>

              <p className="text-[#666662] text-sm sm:text-base leading-relaxed font-sans mb-8 max-w-lg">
                Discover instruments engineered for acoustic precision, tactile delight, and enduring presence. Designed for the way you live and create.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <button
                  id="hero-shop-now-btn"
                  onClick={() => navigate('/shop')}
                  className="px-8 py-4 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Shop Collection</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => navigate('/products/prod_1')}
                  className="px-6 py-4 border border-[#E5E5E2] hover:bg-[#F4F4F1] text-[#1A1A1A] text-xs uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Explore Aura Studio Wireless</span>
                </button>
              </div>

              {/* Social Proof Quote */}
              <div className="mt-12 pt-6 border-t border-[#F0F0EE] flex items-center gap-4 text-xs text-[#9A9A95]">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <span>4.9 / 5.0 Average rating across 1,800+ verified studio owners in India</span>
              </div>
            </div>
          </div>

          {/* Right Showcase Visual */}
          <div className="lg:col-span-5 bg-[#F4F4F1] p-8 sm:p-12 flex flex-col justify-between items-center relative">
            <div className="w-full flex justify-between items-center text-[10px] uppercase tracking-widest text-[#9A9A95]">
              <span>Featured Instrument</span>
              <span className="font-semibold text-[#1A1A1A]">₹2,499.00</span>
            </div>

            <div className="relative my-auto w-full max-w-sm aspect-square flex items-center justify-center p-4">
              <img
                src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"
                alt="Aura Studio Wireless"
                className="w-full h-full object-contain filter drop-shadow-2xl transition-transform duration-700 hover:scale-105"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="w-full bg-white p-4 border border-[#E5E5E2] flex items-center justify-between">
              <div>
                <h4 className="font-serif italic text-sm text-[#1A1A1A]">
                  Aura Studio Hi-Fi Wireless
                </h4>
                <p className="text-[10px] uppercase tracking-wider text-[#9A9A95]">
                  Beryllium Acoustic • 40h Battery
                </p>
              </div>
              <button
                onClick={() => navigate('/products/prod_1')}
                className="text-xs uppercase tracking-widest font-bold text-[#1A1A1A] hover:text-[#D44D2F] flex items-center gap-1"
              >
                <span>View</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* 2. Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-4 border-b border-[#E5E5E2] gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#9A9A95] block mb-1">
              Curated Catalog
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif italic text-[#1A1A1A]">
              Explore by Category
            </h2>
          </div>
          <button
            onClick={() => navigate('/shop')}
            className="text-xs uppercase tracking-widest font-bold text-[#1A1A1A] hover:text-[#D44D2F] flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Browse All Products</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {CATEGORY_CARDS.map(cat => (
            <div
              key={cat.name}
              onClick={() => navigate(`/shop?category=${cat.category}`)}
              className="group relative bg-[#F4F4F1] border border-[#E5E5E2] hover:border-[#1A1A1A] transition-all p-4 flex flex-col justify-between aspect-3/4 cursor-pointer overflow-hidden rounded-xs"
            >
              <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden mb-2">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover filter transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="pt-2 border-t border-[#E5E5E2] bg-[#F4F4F1]">
                <h4 className="font-serif italic text-sm text-[#1A1A1A] group-hover:text-[#D44D2F] transition-colors leading-tight">
                  {cat.name}
                </h4>
                <span className="text-[9px] uppercase tracking-wider text-[#9A9A95]">
                  {cat.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Featured Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-4 border-b border-[#E5E5E2] gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#9A9A95] block mb-1">
              Handpicked Essentials
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif italic text-[#1A1A1A]">
              Featured Products
            </h2>
          </div>
          <button
            onClick={() => navigate('/shop')}
            className="text-xs uppercase tracking-widest font-bold text-[#1A1A1A] hover:text-[#D44D2F] flex items-center gap-1"
          >
            <span>View All ({MOCK_PRODUCTS.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* 4. Promotional Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="bg-[#1A1A1A] text-white border border-[#333330] p-8 sm:p-14 lg:p-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center rounded-xs overflow-hidden">
          <div className="lg:col-span-7 space-y-4">
            <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#D44D2F] block">
              Studio Special Edition
            </span>
            <h3 className="text-3xl sm:text-4xl font-serif italic leading-tight">
              The Tactile 75 Mechanical Keyboard.
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed max-w-lg font-sans">
              Precision milled aluminium with 5-layer acoustic dampening and factory-lubed custom switches. Tri-mode wireless connectivity with Mac & Windows support.
            </p>
            <div className="pt-2 flex items-center gap-4">
              <button
                onClick={() => navigate('/products/prod_3')}
                className="px-6 py-3.5 bg-white text-[#1A1A1A] hover:bg-neutral-200 text-xs uppercase tracking-widest font-bold transition-colors cursor-pointer"
              >
                Shop Tactile 75 • ₹4,299
              </button>
              <span className="text-[10px] uppercase tracking-widest text-neutral-400">
                28% Curated Privilege
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <img
              src="https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80"
              alt="Keyboard Promotion"
              className="max-h-64 object-contain filter drop-shadow-2xl rounded-sm"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      {/* 5. Trending Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-4 border-b border-[#E5E5E2] gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#9A9A95] block mb-1">
              Most Coveted
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif italic text-[#1A1A1A]">
              Trending in the Studio
            </h2>
          </div>
          <button
            onClick={() => navigate('/shop')}
            className="text-xs uppercase tracking-widest font-bold text-[#1A1A1A] hover:text-[#D44D2F] flex items-center gap-1"
          >
            <span>Explore Store</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {trendingProducts.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

    </div>
  );
};
