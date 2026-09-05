import React, { useState, useEffect } from 'react';
import {
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  Heart,
  ShoppingBag,
  Check,
  MapPin,
  ArrowRight,
  Share2,
} from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { api } from '../services/api';
import { Product, ProductVariant } from '../types/product';
import { ProductCard } from '../components/ProductCard';

export const ProductDetailsPage: React.FC = () => {
  const { params, navigate } = useRouter();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [quantity, setQuantity] = useState<number>(1);
  const [pincode, setPincode] = useState<string>('400050');
  const [deliveryResult, setDeliveryResult] = useState<string | null>('Express Delivery in 2–3 Days (Bandra, Mumbai)');
  const [addedNotice, setAddedNotice] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'specs' | 'desc' | 'shipping'>('specs');

  const productId = params.productId || 'prod_1';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    api.getProduct(productId).then(prod => {
      if (prod) {
        setProduct(prod);
        setSelectedImage(prod.images[0] || prod.thumbnail);
        setSelectedVariant(prod.variants[0]);
        setQuantity(1);

        // Fetch related products from same category
        api.getProducts({ category: prod.category }).then(all => {
          setRelatedProducts(all.filter(p => p.id !== prod.id).slice(0, 4));
        });
      }
    });
  }, [productId]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <div className="w-8 h-8 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs text-[#9A9A95] font-serif italic">Loading instrument specifications...</p>
      </div>
    );
  }

  const isFavorite = isInWishlist(product.id);

  const handleAddToCart = () => {
    addToCart(product, selectedVariant, quantity);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2200);
  };

  const handleBuyNow = () => {
    addToCart(product, selectedVariant, quantity);
    navigate('/checkout');
  };

  const handlePincodeCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincode.trim().length === 6) {
      setDeliveryResult(`Express Delivery available in 2–3 Business Days to pincode ${pincode}`);
    } else {
      setDeliveryResult('Please enter a valid 6-digit postal code');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-16">
      
      {/* Breadcrumb path */}
      <nav className="flex items-center space-x-2 text-[10px] uppercase tracking-widest text-[#9A9A95]">
        <button onClick={() => navigate('/')} className="hover:text-[#1A1A1A]">Home</button>
        <span>/</span>
        <button onClick={() => navigate('/shop')} className="hover:text-[#1A1A1A]">Shop</button>
        <span>/</span>
        <button onClick={() => navigate(`/shop?category=${product.category}`)} className="hover:text-[#1A1A1A]">
          {product.category}
        </button>
        <span>/</span>
        <span className="text-[#1A1A1A] font-semibold truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Product Showcase Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        
        {/* Gallery Visuals (Cols 1-7) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Selected Image */}
          <div className="relative w-full aspect-square bg-[#F4F4F1] border border-[#E5E5E2] p-8 sm:p-14 flex items-center justify-center overflow-hidden rounded-xs">
            {product.badge && (
              <span className="absolute top-4 left-4 bg-[#1A1A1A] text-white text-[9px] uppercase tracking-widest font-bold px-2.5 py-1">
                {product.badge}
              </span>
            )}
            {product.discount > 0 && (
              <span className="absolute top-4 right-4 bg-[#D44D2F] text-white text-[9px] uppercase tracking-widest font-bold px-2.5 py-1">
                {product.discount}% OFF
              </span>
            )}
            <img
              src={selectedImage}
              alt={product.name}
              className="w-full h-full object-contain filter drop-shadow-xl transition-all duration-300"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Thumbnail Strip */}
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`aspect-square bg-[#F4F4F1] border p-2 flex items-center justify-center transition-all cursor-pointer rounded-xs ${
                    selectedImage === img
                      ? 'border-[#1A1A1A] ring-1 ring-[#1A1A1A]'
                      : 'border-[#E5E5E2] hover:border-[#9A9A95]'
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.name} preview ${idx + 1}`}
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Purchase & Specification Details (Cols 8-12) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Category & Title */}
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#9A9A95] block mb-2">
              {product.category} Instrument
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif italic text-[#1A1A1A] leading-tight mb-3">
              {product.name}
            </h1>

            {/* Rating & Reviews */}
            <div className="flex items-center gap-3 text-xs text-[#666662]">
              <div className="flex items-center text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i < Math.floor(product.rating) ? 'fill-current' : 'text-neutral-300'
                    }`}
                  />
                ))}
              </div>
              <span className="font-semibold text-[#1A1A1A]">{product.rating}</span>
              <span>•</span>
              <span className="text-[#9A9A95]">{product.reviewCount} Verified Reviews</span>
              <span>•</span>
              <span className="text-emerald-700 font-medium">In Stock ({product.stock} units)</span>
            </div>
          </div>

          {/* Pricing */}
          <div className="p-4 bg-[#FBFBF9] border border-[#E5E5E2] flex items-baseline justify-between">
            <div>
              <span className="text-xs text-[#9A9A95] block uppercase tracking-wider mb-1">
                Studio Price (Incl. GST)
              </span>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl sm:text-3xl font-bold font-sans text-[#1A1A1A]">
                  ₹{product.price.toLocaleString('en-IN')}
                </span>
                {product.originalPrice > product.price && (
                  <span className="text-sm text-[#9A9A95] line-through font-sans">
                    ₹{product.originalPrice.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
            </div>
            {product.discount > 0 && (
              <span className="text-xs text-[#D44D2F] font-bold uppercase tracking-wider">
                Save ₹{(product.originalPrice - product.price).toLocaleString('en-IN')} ({product.discount}%)
              </span>
            )}
          </div>

          {/* Short description */}
          <p className="text-xs sm:text-sm text-[#666662] leading-relaxed font-sans">
            {product.description}
          </p>

          {/* Variant Selector (Colors, Sizes, Switches) */}
          {product.variants.length > 0 && (
            <div className="space-y-3 pt-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-[#1A1A1A] block">
                Variant:{' '}
                <span className="text-[#666662] font-normal">
                  {selectedVariant?.name}
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                {product.variants.map(variant => {
                  const isSelected = selectedVariant?.id === variant.id;
                  return (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant)}
                      className={`px-3.5 py-2 text-xs border transition-all cursor-pointer flex items-center gap-2 rounded-none ${
                        isSelected
                          ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white font-medium'
                          : 'border-[#E5E5E2] bg-white text-[#1A1A1A] hover:border-[#1A1A1A]'
                      }`}
                    >
                      {variant.type === 'color' && (
                        <span
                          className="w-3 h-3 rounded-full border border-neutral-300"
                          style={{ backgroundColor: variant.value }}
                        />
                      )}
                      <span>{variant.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity & CTA Buttons */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-4">
              {/* Quantity Picker */}
              <div className="flex items-center border border-[#E5E5E2] bg-white">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-[#1A1A1A] hover:bg-[#F4F4F1] font-bold text-sm"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="px-4 py-2 text-xs font-bold text-[#1A1A1A] min-w-10 text-center font-sans">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  className="px-3 py-2 text-[#1A1A1A] hover:bg-[#F4F4F1] font-bold text-sm"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              {/* Wishlist Button */}
              <button
                onClick={() => toggleWishlist(product.id)}
                className={`p-3 border rounded-none transition-colors cursor-pointer ${
                  isFavorite
                    ? 'border-[#D44D2F] bg-[#D44D2F] text-white'
                    : 'border-[#E5E5E2] bg-white text-[#1A1A1A] hover:border-[#1A1A1A]'
                }`}
                aria-label="Add to Wishlist"
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* CTAs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                id="add-to-bag-cta"
                onClick={handleAddToCart}
                className={`py-4 px-6 text-xs uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                  addedNotice
                    ? 'bg-emerald-800 text-white'
                    : 'bg-[#1A1A1A] hover:bg-[#333] text-white'
                }`}
              >
                {addedNotice ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Added to Bag</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add to Bag</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBuyNow}
                className="py-4 px-6 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] text-xs uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Buy Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Postal Delivery Estimator */}
          <div className="p-4 bg-white border border-[#E5E5E2] space-y-3">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#1A1A1A] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#D44D2F]" />
              <span>Check Delivery Availability</span>
            </span>
            <form onSubmit={handlePincodeCheck} className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={e => setPincode(e.target.value)}
                placeholder="Enter 6-digit Pincode"
                className="flex-1 px-3 py-2 bg-[#FBFBF9] border border-[#E5E5E2] text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#1A1A1A] text-white text-xs uppercase tracking-wider font-bold"
              >
                Check
              </button>
            </form>
            {deliveryResult && (
              <p className="text-xs text-emerald-800 font-medium pt-1">
                {deliveryResult}
              </p>
            )}
          </div>

          {/* Quick Assurance Badges */}
          <div className="grid grid-cols-3 gap-2 text-center pt-2">
            <div className="p-2.5 bg-[#FBFBF9] border border-[#E5E5E2] space-y-1">
              <Truck className="w-4 h-4 mx-auto text-[#1A1A1A]" />
              <span className="text-[9px] uppercase tracking-wider text-[#666662] block font-semibold">
                Free Over ₹999
              </span>
            </div>
            <div className="p-2.5 bg-[#FBFBF9] border border-[#E5E5E2] space-y-1">
              <ShieldCheck className="w-4 h-4 mx-auto text-[#1A1A1A]" />
              <span className="text-[9px] uppercase tracking-wider text-[#666662] block font-semibold">
                1-Yr Warranty
              </span>
            </div>
            <div className="p-2.5 bg-[#FBFBF9] border border-[#E5E5E2] space-y-1">
              <RotateCcw className="w-4 h-4 mx-auto text-[#1A1A1A]" />
              <span className="text-[9px] uppercase tracking-wider text-[#666662] block font-semibold">
                14-Day Returns
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Tabs: Specifications / Philosophy / Shipping */}
      <div className="border border-[#E5E5E2] bg-white">
        <div className="flex border-b border-[#E5E5E2] bg-[#FBFBF9]">
          <button
            onClick={() => setActiveTab('specs')}
            className={`px-6 py-3.5 text-xs uppercase tracking-wider font-bold transition-colors cursor-pointer ${
              activeTab === 'specs'
                ? 'bg-white text-[#1A1A1A] border-b-2 border-[#1A1A1A]'
                : 'text-[#666662] hover:text-[#1A1A1A]'
            }`}
          >
            Technical Specifications
          </button>
          <button
            onClick={() => setActiveTab('desc')}
            className={`px-6 py-3.5 text-xs uppercase tracking-wider font-bold transition-colors cursor-pointer ${
              activeTab === 'desc'
                ? 'bg-white text-[#1A1A1A] border-b-2 border-[#1A1A1A]'
                : 'text-[#666662] hover:text-[#1A1A1A]'
            }`}
          >
            Acoustic & Material Philosophy
          </button>
          <button
            onClick={() => setActiveTab('shipping')}
            className={`px-6 py-3.5 text-xs uppercase tracking-wider font-bold transition-colors cursor-pointer ${
              activeTab === 'shipping'
                ? 'bg-white text-[#1A1A1A] border-b-2 border-[#1A1A1A]'
                : 'text-[#666662] hover:text-[#1A1A1A]'
            }`}
          >
            Shipping & Warranty
          </button>
        </div>

        <div className="p-6 sm:p-10">
          {activeTab === 'specs' && (
            <div className="max-w-3xl">
              <table className="w-full text-xs text-left">
                <tbody>
                  {Object.entries(product.specifications || {}).map(([key, val], idx) => (
                    <tr
                      key={key}
                      className={idx % 2 === 0 ? 'bg-[#FBFBF9]' : 'bg-white'}
                    >
                      <td className="py-3 px-4 font-semibold text-[#1A1A1A] w-1/3 border-b border-[#F0F0EE]">
                        {key}
                      </td>
                      <td className="py-3 px-4 text-[#666662] border-b border-[#F0F0EE]">
                        {val}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'desc' && (
            <div className="max-w-3xl space-y-4 text-xs sm:text-sm text-[#666662] leading-relaxed font-sans">
              <p>
                Every Lumina instrument is designed in our Bandra acoustic laboratory with obsessive attention to resonance, thermal balance, and physical presence.
              </p>
              <p>
                We eschew synthetic bass boosting and artificial treble curves in favor of flat acoustic honesty. The custom components in {product.name} are matched within 0.5dB acoustic tolerance before calibration.
              </p>
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="max-w-3xl space-y-4 text-xs sm:text-sm text-[#666662] leading-relaxed">
              <h4 className="font-serif italic text-base text-[#1A1A1A]">
                Domestic Delivery Standards
              </h4>
              <p>
                Orders are processed and dispatched from our Mumbai distribution center within 24 hours. Standard transit time is 2–4 business days via Bluedart and Delhivery Express.
              </p>
              <h4 className="font-serif italic text-base text-[#1A1A1A] pt-2">
                1-Year Full Studio Warranty
              </h4>
              <p>
                Includes comprehensive hardware coverage against manufacturing defects. If anything goes wrong, we replace the instrument directly at your doorstep without delay.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Customer Reviews Section */}
      <div className="border border-[#E5E5E2] bg-white p-6 sm:p-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#E5E5E2] gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#9A9A95] block mb-1">
              Verified Ownership
            </span>
            <h3 className="font-serif italic text-2xl text-[#1A1A1A]">
              Customer Experiences ({product.reviewCount})
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-3xl font-serif italic text-[#1A1A1A]">
              {product.rating}
            </div>
            <div>
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-current" />
                ))}
              </div>
              <span className="text-[10px] text-[#9A9A95]">Based on 100% verified buyers</span>
            </div>
          </div>
        </div>

        {/* Review Cards */}
        <div className="space-y-6 divide-y divide-[#F0F0EE]">
          {(product.reviews || [
            {
              id: 'rev_sample',
              author: 'Dr. Nikhil Rao',
              rating: 5,
              date: '24 Aug 2026',
              title: 'Exceeds expectation in build and clarity',
              comment: 'I use these daily at my clinical desk. Soundstage separation is clean and the ergonomics are truly second to none.',
              verifiedPurchase: true,
            },
          ]).map(review => (
            <div key={review.id} className="pt-6 first:pt-0 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex text-amber-400">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-current" />
                    ))}
                  </div>
                  <span className="font-serif italic text-sm text-[#1A1A1A] font-semibold">
                    {review.title}
                  </span>
                </div>
                <span className="text-[10px] text-[#9A9A95]">{review.date}</span>
              </div>
              <p className="text-xs text-[#666662] leading-relaxed">
                {review.comment}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-emerald-800 font-medium">
                <Check className="w-3 h-3" />
                <span>{review.author} • Verified Studio Purchaser</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* You Might Also Like */}
      {relatedProducts.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E2]">
            <h3 className="font-serif italic text-2xl text-[#1A1A1A]">
              You Might Also Like
            </h3>
            <button
              onClick={() => navigate('/shop')}
              className="text-xs uppercase tracking-wider font-bold text-[#1A1A1A] hover:text-[#D44D2F]"
            >
              View More
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map(rel => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
