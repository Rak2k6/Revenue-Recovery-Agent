export interface ProductVariant {
  id: string;
  name: string;
  type: 'color' | 'size' | 'edition' | 'storage';
  value: string;
  inStock: boolean;
}

export interface ProductReview {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  category: 'Audio' | 'Electronics' | 'Wearables' | 'Computing' | 'Accessories' | 'Home' | 'Lifestyle';
  price: number;
  originalPrice: number;
  discount: number; // percentage (e.g. 20 for 20%)
  rating: number;
  reviewCount: number;
  images: string[];
  thumbnail: string;
  variants: ProductVariant[];
  specifications: Record<string, string>;
  stock: number;
  isFeatured?: boolean;
  isTrending?: boolean;
  badge?: string;
  reviews?: ProductReview[];
}

export type ProductCategory = Product['category'];

export interface ProductFilterOptions {
  category?: ProductCategory | 'All';
  searchQuery?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  inStockOnly?: boolean;
  discountOnly?: boolean;
  sortBy?: 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest';
}
