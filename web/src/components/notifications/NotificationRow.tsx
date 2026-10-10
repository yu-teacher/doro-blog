import React from 'react';
import type { NotificationItem, NotificationType } from '../../api/types';
import { formatRelative } from '../../utils/date';
import { describeNotification } from '../../utils/notifications';
import { Bell, CornerDownRight, Heart, MessageSquare, Trash2, UserPlus } from 'lucide-react';

interface NotificationRowProps {
  item: NotificationItem;
  onClick: (item: NotificationItem) => void;
  onDelete: (e: React.MouseEvent, id: string, wasRead: boolean) => void;
}

const BADGES: Record<NotificationType, { color: string; icon: React.ReactNode }> = {
  COMMENT: { color: 'bg-emerald-500', icon: <MessageSquare className="w-2.5 h-2.5" /> },
  REPLY: { color: 'bg-blue-500', icon: <CornerDownRight className="w-2.5 h-2.5" /> },
  LIKE: { color: 'bg-rose-500', icon: <Heart className="w-2.5 h-2.5 fill-current" /> },
  FOLLOW: { color: 'bg-purple-500', icon: <UserPlus className="w-2.5 h-2.5" /> },
};

/** 화면이 아직 모르는 알림 종류(서버가 새로 추가한 것)에 쓰는 배지. */
const FALLBACK_BADGE = { color: 'bg-slate-500', icon: <Bell className="w-2.5 h-2.5" /> };

/** 알림 한 줄: 보낸 사람 아바타(종류 배지), 문장, 메시지 일부, 상대 시간, 안 읽음 점, 삭제 버튼. */
export const NotificationRow: React.FC<NotificationRowProps> = ({ item, onClick, onDelete }) => {
  const isUnread = !item.isRead;
  const text = describeNotification(item);
  const badge = BADGES[item.type] ?? FALLBACK_BADGE;

  return (
    <div
      onClick={() => onClick(item)}
      className={`group relative flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
        isUnread
          ? 'bg-emerald-50/40 dark:bg-emerald-950/15 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 overflow-hidden border border-slate-300 dark:border-slate-600">
          {item.sender.profileImageUrl ? (
            <img src={item.sender.profileImageUrl} alt={item.sender.nickname} className="w-full h-full object-cover" />
          ) : (
            item.sender.nickname?.charAt(0).toUpperCase() || 'U'
          )}
        </div>
        <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-white dark:bg-slate-900 shadow-xs">
          <span className={`flex items-center justify-center w-4 h-4 rounded-full ${badge.color} text-white`}>{badge.icon}</span>
        </span>
      </div>

      <div className="flex-1 min-w-0 pr-4 pointer-coarse:pr-8 break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        <div>
          <span className="font-bold text-slate-900 dark:text-slate-100">{item.sender.nickname}</span>
          <span>
            님이{' '}
            {text.target !== null && (
              <span className="font-semibold text-slate-800 dark:text-slate-200">"{text.target}"</span>
            )}
            {text.suffix}
          </span>
        </div>

        {item.message && (
          <div className="mt-1 p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 line-clamp-2 text-[11px] italic">
            "{item.message}"
          </div>
        )}

        <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{formatRelative(item.createdAt, 'monthDay')}</div>
      </div>

      {isUnread && (
        <span className="absolute top-4 right-3 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-950" />
      )}

      <button
        type="button"
        title="알림 삭제"
        aria-label="알림 삭제"
        onClick={(e) => onDelete(e, item.id, item.isRead)}
        className="absolute bottom-2 right-2 p-1 pointer-coarse:p-2.5 pointer-coarse:bottom-0 pointer-coarse:right-0 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors opacity-0 pointer-coarse:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
