import React from 'react';
import type { Comment } from '../../api/types';
import { formatDate } from '../../utils/date';
import { CommentAvatar } from './CommentAvatar';
import { CornerDownRight, Trash2 } from 'lucide-react';

interface ReplyItemProps {
  reply: Comment;
  canDelete: boolean;
  onDelete: (id: string) => void;
}

/** 2단계(답글) 댓글 한 개. */
export const ReplyItem: React.FC<ReplyItemProps> = ({ reply, canDelete, onDelete }) => (
  <div className="pt-2">
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <CornerDownRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
        <CommentAvatar
          nickname={reply.nickname}
          profileImageUrl={reply.profileImageUrl}
          className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs"
        />
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          <span className="font-semibold text-slate-900 dark:text-slate-200 text-xs break-words">{reply.nickname}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 break-all">@{reply.username}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{formatDate(reply.createdAt, 'dateTime')}</span>
        </div>
      </div>

      {canDelete && (
        <button
          onClick={() => onDelete(reply.id)}
          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 transition-colors"
          title="답글 삭제"
          aria-label="답글 삭제"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>

    <div className="mt-1.5 pl-6 text-slate-800 dark:text-slate-300 text-xs leading-relaxed">
      {reply.isDeleted ? (
        <span className="text-slate-400 dark:text-slate-500 italic">삭제된 댓글입니다.</span>
      ) : (
        <p className="whitespace-pre-wrap break-words">{reply.content}</p>
      )}
    </div>
  </div>
);
