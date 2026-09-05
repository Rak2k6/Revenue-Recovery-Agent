import { API_ENDPOINTS } from '../config/api';
import { MOCK_PRODUCTS } from '../data/products';
import { Product, ProductFilterOptions } from '../types/product';
import { Order } from '../types/order';
import { CustomerNotification, NotificationsResponse } from '../types/notification';

// Local storage key for offline/mock order persistence
const LOCAL_ORDERS_KEY = 'lumina_customer_orders';
const CUSTOMER_EMAIL_KEY = 'lumina_customer_email';
const ACTIVE_PAYMENT_ORDER_KEY = 'lumina_active_payment_order';

export class ApiClient {
  setCustomerSession(email: string, orderId?: string): void {
    localStorage.setItem(CUSTOMER_EMAIL_KEY, email.trim().toLowerCase());
    if (orderId) localStorage.setItem(ACTIVE_PAYMENT_ORDER_KEY, orderId);
  }

  async createPaymentOrder(payload: {
    amount: number;
    customerEmail: string;
    receipt?: string;
  }): Promise<{ orderId: string; amount: number; currency: string; keyId: string }> {
    const res = await fetch(API_ENDPOINTS.checkout, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Unable to start payment.');
    }

    return res.json();
  }

  async getPaymentStatus(orderId: string): Promise<{
    state: 'PROCESSING' | 'FAILED' | 'RECOVERY_PROCESSING' | 'RECOVERY_READY' | 'PAID';
    orderId?: string;
    paymentLinkUrl?: string;
    message: string;
  }> {
    const res = await fetch(API_ENDPOINTS.paymentStatus(orderId), {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) throw new Error('Unable to retrieve payment status.');
    return res.json();
  }

  async getNotifications(): Promise<NotificationsResponse> {
    const params = new URLSearchParams();
    const email = localStorage.getItem(CUSTOMER_EMAIL_KEY);
    const orderId = localStorage.getItem(ACTIVE_PAYMENT_ORDER_KEY);
    if (email) params.set('email', email);
    if (orderId) params.set('orderId', orderId);
    const res = await fetch(`${API_ENDPOINTS.notifications}?${params.toString()}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Notifications are unavailable.');
    const data = await res.json();
    const notifications = [...(data.notifications || [])];
    const storedCart = localStorage.getItem('lumina_cart_v2');
    const activeOrderId = localStorage.getItem(ACTIVE_PAYMENT_ORDER_KEY);
    try {
      const cartItems = storedCart ? JSON.parse(storedCart) : [];
      if (Array.isArray(cartItems) && cartItems.length > 0 && !activeOrderId) {
        notifications.unshift({
          id: 'store-checkout-incomplete',
          type: 'CHECKOUT_ABANDONED',
          title: 'Checkout incomplete',
          message: 'Your items are still waiting in your cart.',
          actionLabel: 'Continue Checkout',
          actionUrl: '/checkout',
          state: 'ACTION_REQUIRED',
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      // Ignore malformed local cart state.
    }

    return {
      notifications,
      unreadCount: notifications.filter((notification: CustomerNotification) => !notification.read).length,
      serverTime: data.serverTime || new Date().toISOString(),
    };
  }

  async getUnreadNotifications(): Promise<CustomerNotification[]> {
    const data = await this.getNotifications();
    return data.notifications.filter(notification => !notification.read);
  }

  async markNotificationRead(id: string): Promise<boolean> {
    return Boolean(id);
  }

  async markAllNotificationsRead(): Promise<boolean> {
    return true;
  }

  /**
   * Fetch product catalog with filtering & sorting
   */
  async getProducts(options?: ProductFilterOptions): Promise<Product[]> {
    try {
      const res = await fetch(API_ENDPOINTS.products);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          return this.applyProductFilters(data.products, options);
        }
      }
    } catch {
      // Backend catalog endpoint not active, seamlessly use mock catalog
    }

    return this.applyProductFilters(MOCK_PRODUCTS, options);
  }

  /**
   * Fetch a single product by ID or slug
   */
  async getProduct(idOrSlug: string): Promise<Product | null> {
    try {
      const res = await fetch(API_ENDPOINTS.productDetails(idOrSlug));
      if (res.ok) {
        const data = await res.json();
        if (data.product) return data.product;
      }
    } catch {
      // fallback to mock
    }

    const found = MOCK_PRODUCTS.find(
      p => p.id === idOrSlug || p.slug === idOrSlug
    );
    return found || null;
  }

  /**
   * Filter and sort products locally or from server
   */
  private applyProductFilters(products: Product[], options?: ProductFilterOptions): Product[] {
    if (!options) return [...products];

    let result = [...products];

    // Category filter
    if (options.category && options.category !== 'All') {
      result = result.filter(p => p.category.toLowerCase() === options.category?.toLowerCase());
    }

    // Search query filter (matches name, description, category)
    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    // Price range
    if (options.minPrice !== undefined) {
      result = result.filter(p => p.price >= (options.minPrice || 0));
    }
    if (options.maxPrice !== undefined) {
      result = result.filter(p => p.price <= (options.maxPrice || Infinity));
    }

    // Rating
    if (options.rating !== undefined && options.rating > 0) {
      result = result.filter(p => p.rating >= (options.rating || 0));
    }

    // In Stock only
    if (options.inStockOnly) {
      result = result.filter(p => p.stock > 0);
    }

    // Discount only
    if (options.discountOnly) {
      result = result.filter(p => p.discount > 0);
    }

    // Sorting
    if (options.sortBy) {
      switch (options.sortBy) {
        case 'price-asc':
          result.sort((a, b) => a.price - b.price);
          break;
        case 'price-desc':
          result.sort((a, b) => b.price - a.price);
          break;
        case 'rating':
          result.sort((a, b) => b.rating - a.rating);
          break;
        case 'newest':
          result.reverse();
          break;
        case 'featured':
        default:
          result.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
          break;
      }
    }

    return result;
  }

  /**
   * Create an order (checkout)
   */
  async createOrder(orderPayload: Partial<Order>): Promise<Order> {
    const paymentOrder = await this.createPaymentOrder({
      amount: orderPayload.total || 0,
      customerEmail: orderPayload.customerInfo?.email || '',
      receipt: `store_${Date.now()}`,
    });
    const orderId = paymentOrder.orderId;
    this.setCustomerSession(orderPayload.customerInfo?.email || '', orderId);
    const newOrder: Order = {
      id: orderId,
      orderNumber: orderId,
      date: new Date().toISOString(),
      items: orderPayload.items || [],
      subtotal: orderPayload.subtotal || 0,
      discount: orderPayload.discount || 0,
      deliveryFee: orderPayload.deliveryFee || 0,
      total: orderPayload.total || 0,
      status: 'CONFIRMED',
      customerInfo: orderPayload.customerInfo || {
        fullName: 'Rahul Sharma',
        email: 'customer@example.com',
        phone: '+91 98765 43210',
      },
      shippingAddress: orderPayload.shippingAddress || {
        street: '402, Sea View Residency',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
        country: 'India',
      },
      deliveryMethod: orderPayload.deliveryMethod || {
        id: 'standard',
        name: 'Standard Delivery',
        description: 'Estimated 3–5 Business Days',
        price: 0,
        estimatedDeliveryDays: '3–5 days',
      },
      paymentMethod: orderPayload.paymentMethod || 'upi',
      trackingNumber: `TRK-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      estimatedDeliveryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString(
        'en-IN',
        { day: 'numeric', month: 'short', year: 'numeric' }
      ),
      razorpayKeyId: paymentOrder.keyId,
    };

    this.saveOrderLocally(newOrder);
    return newOrder;
  }

  /**
   * Retrieve order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    const orders = this.getStoredOrders();
    const found = orders.find(o => o.id === orderId || o.orderNumber === orderId);
    if (found) return found;

    // Default mock fallback if refreshed
    return {
      id: orderId,
      orderNumber: orderId,
      date: new Date().toISOString(),
      items: [
        {
          id: 'item_default',
          product: MOCK_PRODUCTS[0],
          quantity: 1,
          selectedVariant: MOCK_PRODUCTS[0].variants[0],
        },
      ],
      subtotal: MOCK_PRODUCTS[0].price,
      discount: 0,
      deliveryFee: 0,
      total: MOCK_PRODUCTS[0].price,
      status: 'CONFIRMED',
      customerInfo: {
        fullName: 'Rahul Sharma',
        email: 'customer@example.com',
        phone: '+91 98765 43210',
      },
      shippingAddress: {
        street: '402, Sea View Residency, Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
        country: 'India',
      },
      deliveryMethod: {
        id: 'standard',
        name: 'Standard Express Courier',
        description: 'Estimated 3–5 Business Days',
        price: 0,
        estimatedDeliveryDays: '3–5 days',
      },
      paymentMethod: 'upi',
      trackingNumber: 'TRK-LUM89201',
      estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(
        'en-IN',
        { day: 'numeric', month: 'short', year: 'numeric' }
      ),
    };
  }

  /**
   * Get customer order history
   */
  async getCustomerOrders(): Promise<Order[]> {
    const local = this.getStoredOrders();
    if (local.length > 0) return local;

    // Initial seed orders
    const seed: Order[] = [
      {
        id: 'ORD-104921',
        orderNumber: 'ORD-104921',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            id: 'ord_item_1',
            product: MOCK_PRODUCTS[2], // Mechanical keyboard
            quantity: 1,
            selectedVariant: MOCK_PRODUCTS[2].variants[0],
          },
        ],
        subtotal: 4299,
        discount: 0,
        deliveryFee: 0,
        total: 4299,
        status: 'SHIPPED',
        customerInfo: {
          fullName: 'Rahul Sharma',
          email: 'customer@example.com',
          phone: '+91 98765 43210',
        },
        shippingAddress: {
          street: '402, Sea View Residency, Bandra West',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400050',
          country: 'India',
        },
        deliveryMethod: {
          id: 'standard',
          name: 'Standard Delivery',
          description: '3–5 days',
          price: 0,
          estimatedDeliveryDays: '3–5 days',
        },
        paymentMethod: 'upi',
        trackingNumber: 'TRK-982144',
        estimatedDeliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      },
      {
        id: 'ORD-102830',
        orderNumber: 'ORD-102830',
        date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            id: 'ord_item_2',
            product: MOCK_PRODUCTS[6], // Laptop stand
            quantity: 1,
          },
        ],
        subtotal: 1299,
        discount: 0,
        deliveryFee: 0,
        total: 1299,
        status: 'DELIVERED',
        customerInfo: {
          fullName: 'Rahul Sharma',
          email: 'customer@example.com',
          phone: '+91 98765 43210',
        },
        shippingAddress: {
          street: '402, Sea View Residency, Bandra West',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400050',
          country: 'India',
        },
        deliveryMethod: {
          id: 'standard',
          name: 'Standard Delivery',
          description: '3–5 days',
          price: 0,
          estimatedDeliveryDays: '3–5 days',
        },
        paymentMethod: 'card',
        trackingNumber: 'TRK-771822',
        estimatedDeliveryDate: 'Delivered on 25 Aug 2026',
      },
    ];

    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(seed));
    return seed;
  }

  /**
   * Create Checkout Session
   */
  async createCheckoutSession(payload: any): Promise<any> {
    return this.createPaymentOrder(payload);
  }

  // Helper: Get local orders
  private getStoredOrders(): Order[] {
    try {
      const stored = localStorage.getItem(LOCAL_ORDERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // Helper: Save order locally
  private saveOrderLocally(order: Order): void {
    try {
      const existing = this.getStoredOrders();
      existing.unshift(order);
      localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(existing));
    } catch {
      // ignore
    }
  }

  // Helper: Mock normal e-commerce customer notifications
  private getMockCustomerNotifications(): CustomerNotification[] {
    return [
      {
        id: 'notif_order_shipped',
        type: 'ORDER_SHIPPED',
        title: 'Order Dispatched',
        message: 'Your Tactile 75 Mechanical Keyboard is on its way via Bluedart Express.',
        actionUrl: '/orders/ORD-104921',
        actionLabel: 'Track Package',
        state: 'UNREAD',
        read: false,
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        metadata: { orderId: 'ORD-104921' },
      },
      {
        id: 'notif_back_in_stock',
        type: 'STOCK_ALERT',
        title: 'Back in Stock: Aura Studio Wireless',
        message: 'The item on your wishlist is back in stock. Limited units available.',
        actionUrl: '/products/prod_1',
        actionLabel: 'Shop Now',
        state: 'READ',
        read: true,
        createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      },
      {
        id: 'notif_welcome',
        type: 'PROMOTIONAL',
        title: 'Welcome to Lumina Goods',
        message: 'Use code LUMINA10 for 10% off your first studio order.',
        actionUrl: '/shop',
        actionLabel: 'Explore Catalog',
        state: 'READ',
        read: true,
        createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      },
    ];
  }
}

export const api = new ApiClient();
