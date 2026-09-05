// Centralized API Configuration

export const API_BASE_URL: string =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:3000';

export const API_ENDPOINTS = {
  products: `${API_BASE_URL}/api/products`,
  productDetails: (id: string) => `${API_BASE_URL}/api/products/${id}`,
  checkout: `${API_BASE_URL}/api/store/checkout`,
  createCheckoutSession: `${API_BASE_URL}/api/checkout/session`,
  orders: `${API_BASE_URL}/api/orders`,
  orderDetails: (id: string) => `${API_BASE_URL}/api/orders/${id}`,
  customerOrders: `${API_BASE_URL}/api/customer/orders`,
  notifications: `${API_BASE_URL}/api/store/notifications`,
  notificationsUnread: `${API_BASE_URL}/api/store/notifications`,
  markNotificationRead: (id: string) => `${API_BASE_URL}/api/notifications/${id}/read`,
  markAllNotificationsRead: `${API_BASE_URL}/api/notifications/mark-all-read`,
  notificationStream: `${API_BASE_URL}/api/notifications/stream`,
  recoveryPay: `${API_BASE_URL}/api/recovery/pay`,
  recoveryDetails: (id: string) => `${API_BASE_URL}/api/recovery/${id}`,
  demoReset: `${API_BASE_URL}/api/demo/reset`,
  demoStatus: `${API_BASE_URL}/api/demo/status`,
  paymentStatus: (orderId: string) => `${API_BASE_URL}/api/store/payments/${encodeURIComponent(orderId)}/status`,
};

export const NOTIFICATION_POLL_INTERVAL =
  Number((import.meta.env && import.meta.env.VITE_NOTIFICATION_POLL_INTERVAL) || 4000);
