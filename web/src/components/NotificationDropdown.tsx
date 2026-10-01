import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { NotificationItem } from '../api/types';
import { useAuthStore } from '../store/authStore';
import {
  Bell,
  CheckCheck,
  MessageSquare,
  CornerDownRight,
  Heart,
  UserPlus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { formatRelative } from '../utils/date';

export const NotificationDropdown: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Unread count fetcher
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const count = await blogApi.getUnreadNotificationCount();
      setUnreadCount(count);
    } catch (err: unknown) {
      // 백그라운드 폴링이라 사용자에게 알리지 않되, 원인 추적을 위해 기록은 남긴다
      console.warn('Failed to poll unread notification count', err);
    }
  }, [isAuthenticated]);

  // Notifications fetcher
  const loadNotifications = async (targetPage = 0, append = false) => {
    setLoading(true);
    try {
      const res = await blogApi.getNotifications(targetPage, 15);
      if (append) {
        setNotifications((prev) => [...prev, ...res.content]);
      } else {
        setNotifications(res.content);
      }
      setPage(res.number);
      setHasMore(res.number + 1 < res.totalPages);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Periodic polling for unread count (every 30 seconds)
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnreadCount();

    const timer = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(timer);
  }, [isAuthenticated, fetchUnreadCount]);

  // When dropdown opens, load page 0
  useEffect(() => {
    if (isOpen) {
      loadNotifications(0, false);
      fetchUnreadCount();
    }
  }, [isOpen]);

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle single item click
  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await blogApi.markNotificationAsRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }

    setIsOpen(false);

    // Navigation logic
    if (item.targetPostSlug) {
      const username = item.targetUsername || item.sender.username;
      navigate(`/@${username}/${item.targetPostSlug}`);
    } else if (item.type === 'FOLLOW') {
      navigate(`/@${item.sender.username}`);
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await blogApi.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  // Handle delete single notification
  const handleDeleteNotification = async (e: React.MouseEvent, id: string, wasRead: boolean) => {
    e.stopPropagation();
    try {
      await blogApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (!wasRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="알림"
        className="relative p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-extrabold text-white bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-in zoom-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">알림</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-full">
                  {unreadCount}개 안 읽음
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                모두 읽음
              </button>
            )}
          </div>

          {/* List Area */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <span className="text-xs">알림을 불러오는 중...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                <Bell className="w-9 h-9 stroke-1 mb-2 opacity-40" />
                <p className="text-xs font-medium">새로운 알림이 없습니다.</p>
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !item.isRead;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`group relative flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
                      isUnread
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/15 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Sender Avatar with Type Icon Badge */}
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 overflow-hidden border border-slate-300 dark:border-slate-600">
                        {item.sender.profileImageUrl ? (
                          <img
                            src={item.sender.profileImageUrl}
                            alt={item.sender.nickname}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          item.sender.nickname?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>

                      {/* Type Badge */}
                      <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-white dark:bg-slate-900 shadow-xs">
                        {item.type === 'COMMENT' && (
                          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white">
                            <MessageSquare className="w-2.5 h-2.5" />
                          </span>
                        )}
                        {item.type === 'REPLY' && (
                          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white">
                            <CornerDownRight className="w-2.5 h-2.5" />
                          </span>
                        )}
                        {item.type === 'LIKE' && (
                          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white">
                            <Heart className="w-2.5 h-2.5 fill-current" />
                          </span>
                        )}
                        {item.type === 'FOLLOW' && (
                          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-purple-500 text-white">
                            <UserPlus className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {item.sender.nickname}
                        </span>
                        {item.type === 'COMMENT' && (
                          <span>
                            님이{' '}
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              "{item.targetPostTitle}"
                            </span>
                            에 댓글을 남겼습니다.
                          </span>
                        )}
                        {item.type === 'REPLY' && (
                          <span>
                            님이{' '}
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              "{item.targetPostTitle}"
                            </span>
                            의 댓글에 답글을 남겼습니다.
                          </span>
                        )}
                        {item.type === 'LIKE' && (
                          <span>
                            님이{' '}
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              "{item.targetPostTitle}"
                            </span>
                            글을 좋아합니다.
                          </span>
                        )}
                        {item.type === 'FOLLOW' && (
                          <span>님이 회원님을 팔로우하기 시작했습니다.</span>
                        )}
                      </div>

                      {/* Comment Message Snippet (if available) */}
                      {item.message && (
                        <div className="mt-1 p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 line-clamp-2 text-[11px] italic">
                          "{item.message}"
                        </div>
                      )}

                      {/* Relative Time */}
                      <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        {formatRelative(item.createdAt, 'monthDay')}
                      </div>
                    </div>

                    {/* Unread indicator dot */}
                    {isUnread && (
                      <span className="absolute top-4 right-3 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-950" />
                    )}

                    {/* Delete button (hover on desktop) */}
                    <button
                      type="button"
                      title="알림 삭제"
                      onClick={(e) => handleDeleteNotification(e, item.id, item.isRead)}
                      className="absolute bottom-2 right-2 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}

            {/* Load More Button */}
            {hasMore && (
              <div className="p-2 text-center bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => loadNotifications(page + 1, true)}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
                >
                  {loading ? '불러오는 중...' : '이전 알림 더보기'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
