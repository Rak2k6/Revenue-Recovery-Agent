/**
 * Centralized API & Service Configuration
 * 
 * Keep the exact endpoint paths configurable because the existing backend API
 * may use different routes in various deployment environments.
 */

const envPollInterval = import.meta.env.VITE_NOTIFICATION_POLL_INTERVAL;
const parsedInterval = envPollInterval ? parseInt(envPollInterval, 10) : 4000;

export const API_CONFIG = {
  // Polling interval in milliseconds (configurable via VITE_NOTIFICATION_POLL_INTERVAL)
  pollIntervalMs: !isNaN(parsedInterval) && parsedInterval > 0 ? parsedInterval : 4000,
  
  // Endpoint definitions inside centralized configuration
  endpoints: {
    notifications: '/api/notifications',
    unreadNotifications: '/api/notifications/unread',
    markRead: (id: string) => `/api/notifications/${id}/read`,
    markAllRead: '/api/notifications/mark-all-read',
    stream: '/api/notifications/stream',
    checkout: '/api/checkout',
    recoveryDetails: (identifier: string) => `/api/recovery/${identifier}`,
    recoveryPay: '/api/recovery/pay',
    recoveryWebhook: '/api/recovery/webhook',
    demoReset: '/api/demo/reset',
    demoStatus: '/api/demo/status',
  },
};
