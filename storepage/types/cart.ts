import { Product, ProductVariant } from './product';

export interface CartItem {
  id: string; // unique item id: `${productId}_${variantId || 'default'}`
  product: Product;
  selectedVariant?: ProductVariant;
  quantity: number;
}

export interface CartSummary {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
}
