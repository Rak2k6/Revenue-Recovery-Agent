import React, { useState, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal,
  X,
  Search,
  Check,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { api } from '../services/api';
import { Product, ProductCategory, ProductFilterOptions } from '../types/product';
import { ProductGrid } from '../components/ProductGrid';

const CATEGORIES: (ProductCategory | 'All')[] = [
  'All',
  'Audio',
  'Wearables',
  'Computing',
  'Electronics',
  'Accessories',
  'Home',
  'Lifestyle',
];

export const ShopPage: React.FC = () => {
  const { params, navigate } = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>(
    (params.categoryFilter as any) || 'All'
  );
  const [searchQuery, setSearchQuery] = useState<string>(params.searchQuery || '');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [minRating, setMinRating] = useState<number>(0);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [discountOnly, setDiscountOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<ProductFilterOptions['sortBy']>('featured');

  // Update filter if route changes
  useEffect(() => {
    if (params.categoryFilter) {
      setSelectedCategory(params.categoryFilter as any);
    }
    if (params.searchQuery !== undefined) {
      setSearchQuery(params.searchQuery);
    }
  }, [params.categoryFilter, params.searchQuery]);

  // Fetch products through centralized API
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api
      .getProducts({
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        searchQuery,
        minPrice,
        maxPrice,
        rating: minRating,
        inStockOnly,
        discountOnly,
        sortBy,
      })
      .then(res => {
        if (isMounted) {
          setProducts(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCategory, searchQuery, minPrice, maxPrice, minRating, inStockOnly, discountOnly, sortBy]);

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSearchQuery('');
    setMinPrice(0);
    setMaxPrice(10000);
    setMinRating(0);
    setInStockOnly(false);
    setDiscountOnly(false);
    setSortBy('featured');
    navigate('/shop');
  };

  const hasActiveFilters =
    selectedCategory !== 'All' ||
    searchQuery.trim() !== '' ||
    minPrice > 0 ||
    maxPrice < 10000 ||
    minRating > 0 ||
    inStockOnly ||
    discountOnly;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
      
      {/* Header Section */}
      <div className="border-b border-[#E5E5E2] pb-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#9A9A95] block mb-1">
              Store Catalog
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif italic text-[#1A1A1A]">
              {selectedCategory === 'All' ? 'All Instruments & Goods' : `${selectedCategory} Collection`}
            </h1>
            <p className="text-xs text-[#666662] mt-2 font-sans">
              Precision crafted products with complimentary logistics on orders over ₹999.
            </p>
          </div>

          {/* Right controls: Mobile Filter Toggle & Sort selector */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="lg:hidden px-4 py-2.5 bg-white border border-[#E5E5E2] hover:border-[#1A1A1A] text-xs uppercase tracking-wider font-bold flex items-center gap-2 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-[#D44D2F]" />
              )}
            </button>

            {/* Sort Selector */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="appearance-none bg-white border border-[#E5E5E2] hover:border-[#1A1A1A] text-xs font-medium text-[#1A1A1A] py-2.5 pl-3.5 pr-8 rounded-none cursor-pointer focus:outline-none"
              >
                <option value="featured">Sort: Featured Collection</option>
                <option value="price-asc">Sort: Price (Low to High)</option>
                <option value="price-desc">Sort: Price (High to Low)</option>
                <option value="rating">Sort: Highest Customer Rating</option>
                <option value="newest">Sort: Newly Added</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#9A9A95] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-[#F0F0EE]">
            <span className="text-[10px] uppercase tracking-wider text-[#9A9A95] font-semibold">
              Active Filters:
            </span>

            {selectedCategory !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F4F1] border border-[#E5E5E2] text-xs text-[#1A1A1A]">
                <span>Category: {selectedCategory}</span>
                <X
                  className="w-3 h-3 cursor-pointer hover:text-[#D44D2F]"
                  onClick={() => setSelectedCategory('All')}
                />
              </span>
            )}

            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F4F1] border border-[#E5E5E2] text-xs text-[#1A1A1A]">
                <span>Search: "{searchQuery}"</span>
                <X
                  className="w-3 h-3 cursor-pointer hover:text-[#D44D2F]"
                  onClick={() => setSearchQuery('')}
                />
              </span>
            )}

            {minPrice > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F4F1] border border-[#E5E5E2] text-xs text-[#1A1A1A]">
                <span>Min: ₹{minPrice}</span>
                <X
                  className="w-3 h-3 cursor-pointer hover:text-[#D44D2F]"
                  onClick={() => setMinPrice(0)}
                />
              </span>
            )}

            {maxPrice < 10000 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F4F1] border border-[#E5E5E2] text-xs text-[#1A1A1A]">
                <span>Max: ₹{maxPrice}</span>
                <X
                  className="w-3 h-3 cursor-pointer hover:text-[#D44D2F]"
                  onClick={() => setMaxPrice(10000)}
                />
              </span>
            )}

            {minRating > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F4F1] border border-[#E5E5E2] text-xs text-[#1A1A1A]">
                <span>Rating: {minRating}+ Stars</span>
                <X
                  className="w-3 h-3 cursor-pointer hover:text-[#D44D2F]"
                  onClick={() => setMinRating(0)}
                />
              </span>
            )}

            {inStockOnly && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F4F1] border border-[#E5E5E2] text-xs text-[#1A1A1A]">
                <span>In Stock Only</span>
                <X
                  className="w-3 h-3 cursor-pointer hover:text-[#D44D2F]"
                  onClick={() => setInStockOnly(false)}
                />
              </span>
            )}

            {discountOnly && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F4F1] border border-[#E5E5E2] text-xs text-[#1A1A1A]">
                <span>Special Offers Only</span>
                <X
                  className="w-3 h-3 cursor-pointer hover:text-[#D44D2F]"
                  onClick={() => setDiscountOnly(false)}
                />
              </span>
            )}

            <button
              onClick={handleResetFilters}
              className="text-xs text-[#D44D2F] hover:underline font-semibold ml-2 cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Layout: Desktop Sidebar Filters + Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Desktop Filter Sidebar (Cols 1-3) */}
        <aside className="hidden lg:block lg:col-span-3 bg-white border border-[#E5E5E2] p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E2]">
            <h3 className="font-serif italic text-lg text-[#1A1A1A]">Filter Options</h3>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] uppercase tracking-wider text-[#D44D2F] font-bold hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Search filter */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] block">
              Search Keywords
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Title or specs..."
                className="w-full pl-8 pr-3 py-2 bg-[#FBFBF9] border border-[#E5E5E2] text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
              />
              <Search className="w-3.5 h-3.5 text-[#9A9A95] absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Categories checklist */}
          <div className="space-y-2 pt-2 border-t border-[#F0F0EE]">
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] block">
              Category
            </label>
            <div className="space-y-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left text-xs py-1.5 px-2 flex items-center justify-between transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#1A1A1A] text-white font-medium'
                      : 'text-[#666662] hover:bg-[#F4F4F1] hover:text-[#1A1A1A]'
                  }`}
                >
                  <span>{cat === 'All' ? 'All Collections' : cat}</span>
                  {selectedCategory === cat && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-3 pt-2 border-t border-[#F0F0EE]">
            <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold text-[#9A9A95]">
              <span>Max Price</span>
              <span className="text-[#1A1A1A] font-sans">₹{maxPrice.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min="1000"
              max="10000"
              step="500"
              value={maxPrice}
              onChange={e => setMaxPrice(Number(e.target.value))}
              className="w-full accent-[#1A1A1A] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#9A9A95]">
              <span>₹1,000</span>
              <span>₹10,000</span>
            </div>
          </div>

          {/* Minimum Rating */}
          <div className="space-y-2 pt-2 border-t border-[#F0F0EE]">
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] block">
              Customer Rating
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[0, 4.0, 4.5, 4.8].map(ratingVal => (
                <button
                  key={ratingVal}
                  onClick={() => setMinRating(ratingVal)}
                  className={`py-1.5 text-xs text-center border transition-colors ${
                    minRating === ratingVal
                      ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] font-bold'
                      : 'bg-white text-[#666662] border-[#E5E5E2] hover:border-[#1A1A1A]'
                  }`}
                >
                  {ratingVal === 0 ? 'All' : `${ratingVal}★`}
                </button>
              ))}
            </div>
          </div>

          {/* Availability & Offers */}
          <div className="space-y-2.5 pt-2 border-t border-[#F0F0EE]">
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] block">
              Preferences
            </label>

            <label className="flex items-center gap-2.5 text-xs text-[#1A1A1A] cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={e => setInStockOnly(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#1A1A1A]"
              />
              <span>In-Stock Ready to Dispatch</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-[#1A1A1A] cursor-pointer">
              <input
                type="checkbox"
                checked={discountOnly}
                onChange={e => setDiscountOnly(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#1A1A1A]"
              />
              <span>Special Promotional Offers</span>
            </label>
          </div>
        </aside>

        {/* Product Display Section (Cols 4-12) */}
        <main className="lg:col-span-9 space-y-6">
          <div className="flex items-center justify-between text-xs text-[#9A9A95]">
            <span>
              Showing <strong className="text-[#1A1A1A]">{products.length}</strong> instruments
            </span>
          </div>

          <ProductGrid
            products={products}
            isLoading={loading}
            onResetFilters={handleResetFilters}
          />
        </main>

      </div>

      {/* Mobile Filters Modal Drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex bg-black/50 lg:hidden">
          <div className="ml-auto w-full max-w-xs bg-white h-full p-6 overflow-y-auto space-y-6 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E2]">
              <h3 className="font-serif italic text-lg text-[#1A1A1A]">Filters</h3>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="p-1 text-[#9A9A95] hover:text-[#1A1A1A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] block">
                Category
              </span>
              <div className="space-y-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left text-xs py-2 px-2.5 ${
                      selectedCategory === cat
                        ? 'bg-[#1A1A1A] text-white font-bold'
                        : 'text-[#666662]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2 pt-2 border-t border-[#F0F0EE]">
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#9A9A95] block">
                Max Price: ₹{maxPrice.toLocaleString('en-IN')}
              </span>
              <input
                type="range"
                min="1000"
                max="10000"
                step="500"
                value={maxPrice}
                onChange={e => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[#1A1A1A]"
              />
            </div>

            {/* Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-[#F0F0EE]">
              <label className="flex items-center gap-2 text-xs text-[#1A1A1A]">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={e => setInStockOnly(e.target.checked)}
                  className="accent-[#1A1A1A]"
                />
                <span>In Stock Only</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-[#1A1A1A]">
                <input
                  type="checkbox"
                  checked={discountOnly}
                  onChange={e => setDiscountOnly(e.target.checked)}
                  className="accent-[#1A1A1A]"
                />
                <span>Discount Offers Only</span>
              </label>
            </div>

            <div className="pt-4 border-t border-[#F0F0EE] flex gap-2">
              <button
                onClick={handleResetFilters}
                className="flex-1 py-3 border border-[#E5E5E2] text-xs font-bold uppercase tracking-wider"
              >
                Reset
              </button>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="flex-1 py-3 bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-wider"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
