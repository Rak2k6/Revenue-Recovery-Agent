import React from 'react';
import { Product } from '../types/product';
import { ProductCard } from './ProductCard';
import { ShoppingBag } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  onResetFilters?: () => void;
  isLoading?: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  onResetFilters,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="bg-white border border-[#E5E5E2] animate-pulse aspect-3/4 flex flex-col justify-between p-4"
          >
            <div className="w-full aspect-square bg-[#F4F4F1] mb-4" />
            <div className="h-4 bg-[#F4F4F1] w-3/4 mb-2" />
            <div className="h-3 bg-[#F4F4F1] w-1/2 mb-4" />
            <div className="h-5 bg-[#F4F4F1] w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-20 px-4 text-center bg-white border border-[#E5E5E2] max-w-lg mx-auto my-8">
        <div className="w-12 h-12 rounded-full bg-[#F4F4F1] flex items-center justify-center mx-auto mb-4 text-[#9A9A95]">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <h3 className="font-serif italic text-xl text-[#1A1A1A] mb-2">
          No matching products found
        </h3>
        <p className="text-xs text-[#666662] max-w-sm mx-auto leading-relaxed mb-6 font-sans">
          We couldn't locate any products matching your selected search or filter criteria. Try adjusting your parameters.
        </p>
        {onResetFilters && (
          <button
            onClick={onResetFilters}
            className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs uppercase tracking-widest font-bold transition-colors cursor-pointer"
          >
            Reset All Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};
