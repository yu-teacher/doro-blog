import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NotificationItem } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { useNotifications } from '../hooks/useNotifications';
import { useClickOutside } from '../hooks/useClickOutside';
import { notificationLink } from '../utils/notifications';
import { NotificationRow } from './notifications/NotificationRow';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';

const MAX_BADGE_COUNT = 99;

export const NotificationDropdown: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const notifications = useNotifications(isAuthenticated);
  const { unreadCount, items, loading, hasMore, error } = notifications;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, isOpen, close);

  const toggle = () => {
    if (!isOpen) notifications.open();
    setIsOpen(!isOpen);
  };

  const handleItemClick = async (item: NotificationItem) => {
    await notifications.markRead(item);
    setIsOpen(false);
    const link = notificationLink(item);
    if (link) navigate(link);
  };

  const handleDelete = (e: React.MouseEvent, id: string, wasRead: boolean) => {
    e.stopPropagation();
    void notifications.remove(id, wasRead);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label="알림"
        className="relative p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-extrabold text-white bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-in zoom-in">
            {unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-x-2 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
                onClick={() => void notifications.markAllRead()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer pointer-coarse:min-h-9 pointer-coarse:px-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                모두 읽음
              </button>
            )}
          </div>

          <div className="max-h-[min(380px,calc(100dvh-9rem))] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading && items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <span className="text-xs">알림을 불러오는 중...</span>
              </div>
            ) : error && items.length === 0 ? (
              <div role="alert" className="flex flex-col items-center justify-center gap-2 py-10 text-slate-500 dark:text-slate-400">
                <p className="text-xs font-medium">{error}</p>
                <button type="button" onClick={notifications.open} className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                  다시 시도
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                <Bell className="w-9 h-9 stroke-1 mb-2 opacity-40" />
                <p className="text-xs font-medium">새로운 알림이 없습니다.</p>
              </div>
            ) : (
              items.map((item) => <NotificationRow key={item.id} item={item} onClick={handleItemClick} onDelete={handleDelete} />)
            )}

            {hasMore && (
              <div className="p-2 text-center bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={loading}
                  onClick={notifications.loadMore}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50 pointer-coarse:min-h-9 pointer-coarse:px-3"
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
