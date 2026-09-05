import { API_CONFIG } from '../config/apiConfig';
import { api } from './api';
import { CustomerNotification, NotificationsResponse } from '../types/notification';

type NotificationListener = (notifications: CustomerNotification[], unreadCount: number, latest?: CustomerNotification) => void;

class NotificationService {
  private listeners: Set<NotificationListener> = new Set();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isPollingActive = false;
  private cachedNotifications: CustomerNotification[] = [];
  private lastKnownIdSet: Set<string> = new Set();
  private readNotificationIds: Set<string> = new Set();

  constructor() {}

  /**
   * Subscribe a UI component to notification updates
   */
  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    // Send cached state immediately
    const unread = this.cachedNotifications.filter(n => !n.read).length;
    listener(this.cachedNotifications, unread);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(latest?: CustomerNotification) {
    const unread = this.cachedNotifications.filter(n => !n.read).length;
    this.listeners.forEach(cb => {
      try {
        cb(this.cachedNotifications, unread, latest);
      } catch (err) {
        console.error('Error in notification listener:', err);
      }
    });
  }

  /**
   * Centralized API Method: GET /notifications
   */
  public async getNotifications(): Promise<NotificationsResponse> {
    try {
      const data = await api.getNotifications();
      const safeNotifications: CustomerNotification[] = data.notifications.map(notification => ({
        ...notification,
        read: notification.read || this.readNotificationIds.has(notification.id),
        state: this.readNotificationIds.has(notification.id) && notification.state === 'UNREAD'
          ? 'READ'
          : notification.state,
      }));
      const unreadCount: number = data.unreadCount;

      // Check for newly arrived notifications for toast triggers
      let newArrival: CustomerNotification | undefined;
      safeNotifications.forEach(n => {
        if (!this.lastKnownIdSet.has(n.id)) {
          this.lastKnownIdSet.add(n.id);
          // Only trigger popup for unread/action required new arrivals
          if (!n.read) {
            newArrival = n;
          }
        }
      });

      this.cachedNotifications = safeNotifications;
      this.notifyListeners(newArrival);

      return {
        notifications: safeNotifications,
        unreadCount,
        serverTime: data.serverTime || new Date().toISOString(),
      };
    } catch (error) {
      console.warn('NotificationService.getNotifications failed:', error);
      return {
        notifications: this.cachedNotifications,
        unreadCount: this.cachedNotifications.filter(n => !n.read).length,
        serverTime: new Date().toISOString(),
      };
    }
  }

  /**
   * Centralized API Method: GET /notifications/unread
   */
  public async getUnreadNotifications(): Promise<CustomerNotification[]> {
    try {
      return await api.getUnreadNotifications();
    } catch {
      return this.cachedNotifications.filter(n => !n.read);
    }
  }

  /**
   * Centralized API Method: POST /notifications/:id/read
   */
  public async markNotificationRead(id: string): Promise<boolean> {
    try {
      // Optimistic local update
      this.cachedNotifications = this.cachedNotifications.map(n => 
        n.id === id ? { ...n, read: true, state: n.state === 'UNREAD' ? 'READ' : n.state } : n
      );
      this.readNotificationIds.add(id);
      this.notifyListeners();

      return await api.markNotificationRead(id);
    } catch (error) {
      console.error('Failed to mark notification read:', error);
      return false;
    }
  }

  /**
   * Centralized API Method: Mark all notifications read
   */
  public async markAllRead(): Promise<boolean> {
    try {
      this.cachedNotifications = this.cachedNotifications.map(n => ({
        ...n,
        read: true,
        state: n.state === 'UNREAD' ? 'READ' : n.state,
      }));
      this.cachedNotifications.forEach(notification => this.readNotificationIds.add(notification.id));
      this.notifyListeners();

      return await api.markAllNotificationsRead();
    } catch (error) {
      console.error('Failed to mark all read:', error);
      return false;
    }
  }

  /**
   * Start periodic polling at configurable interval
   */
  public startPolling(customIntervalMs?: number): void {
    if (this.isPollingActive && this.pollTimer) {
      return;
    }

    this.isPollingActive = true;
    const interval = customIntervalMs || API_CONFIG.pollIntervalMs;

    // Immediate initial poll
    this.getNotifications();

    this.pollTimer = setInterval(() => {
      this.getNotifications();
    }, interval);
  }

  /**
   * Stop polling when leaving recovery/order screens
   */
  public stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPollingActive = false;
  }

  public isPolling(): boolean {
    return this.isPollingActive;
  }

  public getCachedNotifications(): CustomerNotification[] {
    return this.cachedNotifications;
  }
}

export const notificationService = new NotificationService();
