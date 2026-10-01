import { useCallback, useEffect, useState } from 'react';
import { blogApi } from '../api/blogApi';
import type { NotificationItem } from '../api/types';
import { getErrorMessage } from '../utils/errors';

const UNREAD_POLL_INTERVAL_MS = 30_000;
const NOTIFICATIONS_PAGE_SIZE = 15;

export interface Notifications {
  unreadCount: number;
  items: NotificationItem[];
  loading: boolean;
  hasMore: boolean;
  /** 마지막 목록 불러오기/조작의 오류 메시지. */
  error: string | null;
  /** 드롭다운을 열 때: 첫 페이지와 안 읽은 수를 다시 불러온다. */
  open: () => void;
  loadMore: () => void;
  markRead: (item: NotificationItem) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string, wasRead: boolean) => Promise<void>;
}

/** 알림 목록과 안 읽은 수(30초마다 갱신). enabled 가 false 면(비로그인) 아무것도 요청하지 않는다. */
export function useNotifications(enabled: boolean): Notifications {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!enabled) return;
    try {
      setUnreadCount(await blogApi.getUnreadNotificationCount());
    } catch (err: unknown) {
      // 백그라운드 폴링이라 사용자에게 알리지 않되, 원인 추적을 위해 기록은 남긴다
      console.warn('Failed to poll unread notification count', err);
    }
  }, [enabled]);

  const loadPage = useCallback(async (targetPage: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await blogApi.getNotifications(targetPage, NOTIFICATIONS_PAGE_SIZE);
      setItems((prev) => (append ? [...prev, ...res.content] : res.content));
      setPage(res.number);
      setHasMore(res.number + 1 < res.totalPages);
    } catch (err: unknown) {
      console.error('Failed to load notifications:', err);
      setError(getErrorMessage(err, '알림을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void fetchUnreadCount();
    const timer = setInterval(() => void fetchUnreadCount(), UNREAD_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, fetchUnreadCount]);

  const open = useCallback(() => {
    void loadPage(0, false);
    void fetchUnreadCount();
  }, [loadPage, fetchUnreadCount]);

  const loadMore = useCallback(() => void loadPage(page + 1, true), [loadPage, page]);

  const markRead = useCallback(async (item: NotificationItem) => {
    if (item.isRead) return;
    try {
      await blogApi.markNotificationAsRead(item.id);
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: unknown) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await blogApi.markAllNotificationsAsRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err: unknown) {
      console.error('Failed to mark all notifications as read:', err);
      setError(getErrorMessage(err, '모두 읽음 처리에 실패했습니다.'));
    }
  }, []);

  const remove = useCallback(async (id: string, wasRead: boolean) => {
    try {
      await blogApi.deleteNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
      if (!wasRead) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: unknown) {
      console.error('Failed to delete notification:', err);
      setError(getErrorMessage(err, '알림을 삭제하지 못했습니다.'));
    }
  }, []);

  return { unreadCount, items, loading, hasMore, error, open, loadMore, markRead, markAllRead, remove };
}
