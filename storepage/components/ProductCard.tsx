import React, { useState } from 'react';
import { Heart, Star, ShoppingBag, Check } from 'lucide-react';
import { Product } from '../types/product';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { navigate } = useRouter();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const [isHovered, setIsHovered] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const isFavorite = isInWishlist(product.id);
  const displayImage =
    isHovered && product.images.length > 1 ? product.images[1] : product.thumbnail;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, product.variants[0], 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  return (
    <div
      onClick={() => navigate(`/products/${product.id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative bg-white border border-[#E5E5E2] hover:border-[#1A1A1A] transition-all duration-300 flex flex-col justify-between cursor-pointer rounded-xs overflow-hidden"
    >
      {/* Top Image Container */}
      <div className="relative w-full aspect-square bg-[#F4F4F1] p-6 flex items-center justify-center overflow-hidden">
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
          {product.badge && (
            <span className="bg-[#1A1A1A] text-white text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-none">
              {product.badge}
            </span>
          )}
          {product.discount > 0 && (
            <span className="bg-[#D44D2F] text-white text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-none">
              {product.discount}% OFF
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={handleWishlistToggle}
          className={`absolute top-3 right-3 z-10 p-2 rounded-full transition-all duration-200 ${
            isFavorite
              ? 'bg-[#D44D2F] text-white'
              : 'bg-white/80 hover:bg-white text-[#1A1A1A] hover:text-[#D44D2F] shadow-xs'
          }`}
          aria-label={isFavorite ? 'Remove from Wishlist' : 'Add to Wishlist'}
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Product Image */}
        <img
          src={displayImage}
          alt={product.name}
          className="w-full h-full object-contain filter drop-shadow-sm transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        {/* Quick Add Overlay on Desktop Hover */}
        <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:block">
          <button
            onClick={handleQuickAdd}
            className={`w-full py-2.5 px-3 text-xs uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md ${
              justAdded
                ? 'bg-emerald-800 text-white'
                : 'bg-[#1A1A1A] hover:bg-[#333] text-white'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added to Bag</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Quick Add</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Product Content Details */}
      <div className="p-5 flex flex-col flex-1 justify-between bg-white border-t border-[#F0F0EE]">
        <div>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#9A9A95] mb-1.5">
            <span>{product.category}</span>
            <div className="flex items-center gap-1 text-[#1A1A1A] font-semibold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{product.rating}</span>
              <span className="text-[#9A9A95] font-normal">({product.reviewCount})</span>
            </div>
          </div>

          <h3 className="font-serif italic text-base sm:text-lg text-[#1A1A1A] leading-snug line-clamp-1 group-hover:text-[#D44D2F] transition-colors">
            {product.name}
          </h3>

          <p className="text-xs text-[#666662] line-clamp-2 mt-1 font-sans leading-relaxed">
            {product.shortDescription || product.description}
          </p>
        </div>

        {/* Price & Mobile Add Button */}
        <div className="pt-4 mt-2 border-t border-[#F0F0EE] flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-sans font-bold text-base text-[#1A1A1A]">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              {product.originalPrice > product.price && (
                <span className="text-xs text-[#9A9A95] line-through">
                  ₹{product.originalPrice.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>

          {/* Mobile Direct Add Icon Button */}
          <button
            onClick={handleQuickAdd}
            className="sm:hidden p-2 bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors rounded-none"
            aria-label="Add to bag"
          >
            {justAdded ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ShoppingBag className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
