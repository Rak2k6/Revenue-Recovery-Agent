import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, ProductVariant } from '../types/product';
import { CartItem } from '../types/cart';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, variant?: ProductVariant, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  promoCode: string;
  applyPromoCode: (code: string) => { success: boolean; message: string };
  removePromoCode: () => void;
  appliedPromoDiscount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'lumina_cart_v2';
const PROMO_STORAGE_KEY = 'lumina_promo_v2';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  });

  const [promoCode, setPromoCode] = useState<string>(() => {
    try {
      return localStorage.getItem(PROMO_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  useEffect(() => {
    try {
      if (promoCode) {
        localStorage.setItem(PROMO_STORAGE_KEY, promoCode);
      } else {
        localStorage.removeItem(PROMO_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [promoCode]);

  const addToCart = (product: Product, variant?: ProductVariant, quantity: number = 1) => {
    const chosenVariant = variant || (product.variants && product.variants[0]);
    const itemId = `${product.id}_${chosenVariant?.id || 'std'}`;

    setItems(prevItems => {
      const existing = prevItems.find(i => i.id === itemId);
      if (existing) {
        return prevItems.map(i =>
          i.id === itemId ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...prevItems,
        {
          id: itemId,
          product,
          selectedVariant: chosenVariant,
          quantity,
        },
      ];
    });
  };

  const removeFromCart = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setItems(prev =>
      prev.map(i => (i.id === itemId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  // Calculations
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  // Delivery: Free for orders over ₹999, else ₹99
  const deliveryFee = subtotal > 999 || items.length === 0 ? 0 : 99;

  // Promo code discounts
  let appliedPromoDiscount = 0;
  if (promoCode.toUpperCase() === 'LUMINA10') {
    appliedPromoDiscount = Math.round(subtotal * 0.1);
  } else if (promoCode.toUpperCase() === 'FLAT500' && subtotal >= 3000) {
    appliedPromoDiscount = 500;
  }

  const discount = appliedPromoDiscount;
  const total = Math.max(0, subtotal - discount + deliveryFee);

  const applyPromoCode = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean === 'LUMINA10') {
      setPromoCode('LUMINA10');
      return { success: true, message: 'LUMINA10 applied! 10% discount added.' };
    }
    if (clean === 'FLAT500') {
      if (subtotal < 3000) {
        return { success: false, message: 'FLAT500 requires minimum order of ₹3,000.' };
      }
      setPromoCode('FLAT500');
      return { success: true, message: 'FLAT500 applied! ₹500 discount added.' };
    }
    return { success: false, message: 'Invalid promotional voucher code.' };
  };

  const removePromoCode = () => {
    setPromoCode('');
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
        discount,
        deliveryFee,
        total,
        promoCode,
        applyPromoCode,
        removePromoCode,
        appliedPromoDiscount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
