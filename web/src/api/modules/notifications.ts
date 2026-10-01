import { apiClient } from '../client';
import type {
  ApiResponse,
  PageResponse,
  NotificationItem,
  UnreadCountResponse,
} from '../types';

/** 알림 API. */
export const notificationsApi = {
  async getNotifications(page = 0, size = 20): Promise<PageResponse<NotificationItem>> {
    const res = await apiClient.get<ApiResponse<PageResponse<NotificationItem>>>('/notifications', {
      params: { page, size },
    });
    return res.data.data;
  },

  async getUnreadNotificationCount(): Promise<number> {
    const res = await apiClient.get<ApiResponse<UnreadCountResponse>>('/notifications/unread-count');
    return res.data.data.unreadCount;
  },

  async markNotificationAsRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  async markAllNotificationsAsRead(): Promise<void> {
    await apiClient.post('/notifications/read-all');
  },

  async deleteNotification(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${id}`);
  },
};
