import { CartItem } from './cart';

export type OrderStatus = 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED';

export interface CustomerInfo {
  fullName: string;
  email: string;
  phone: string;
}

export interface ShippingAddress {
  street: string;
  apartment?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export type DeliveryMethodType = 'standard' | 'express';

export interface DeliveryMethod {
  id: DeliveryMethodType;
  name: string;
  description: string;
  price: number;
  estimatedDeliveryDays: string;
}

export type PaymentMethodType = 'upi' | 'card' | 'netbanking' | 'wallet';

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  customerInfo: CustomerInfo;
  shippingAddress: ShippingAddress;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethodType;
  trackingNumber?: string;
  estimatedDeliveryDate: string;
  razorpayKeyId?: string;
}
