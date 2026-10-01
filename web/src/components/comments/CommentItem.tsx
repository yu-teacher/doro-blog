import React from 'react';
import type { Comment } from '../../api/types';
import { formatDate } from '../../utils/date';
import { CommentAvatar } from './CommentAvatar';
import { COMMENT_MAX_LENGTH } from './commentUtils';
import { ReplyItem } from './ReplyItem';
import { Trash2 } from 'lucide-react';

interface CommentItemProps {
  comment: Comment;
  currentUserId: string | undefined;
  isReplying: boolean;
  replyContent: string;
  submitting: boolean;
  onReplyContentChange: (value: string) => void;
  onToggleReply: () => void;
  onSubmitReply: () => void;
  onDelete: (id: string) => void;
}

/** 최상위 댓글 한 개와 그 답글 목록, 답글 입력창. */
export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  isReplying,
  replyContent,
  submitting,
  onReplyContentChange,
  onToggleReply,
  onSubmitReply,
  onDelete,
}) => {
  const isMine = (userId: string) => currentUserId !== undefined && currentUserId === userId;

  return (
    <div className="border-b border-slate-100 dark:border-slate-800/80 pb-6 last:border-0">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <CommentAvatar
            nickname={comment.nickname}
            profileImageUrl={comment.profileImageUrl}
            className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-sm border border-emerald-200 dark:border-emerald-800"
          />
          <div>
            <span className="font-semibold text-slate-900 dark:text-slate-200 text-sm">{comment.nickname}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">@{comment.username}</span>
            <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(comment.createdAt, 'dateTime')}</p>
          </div>
        </div>

        {!comment.isDeleted && isMine(comment.userId) && (
          <button
            onClick={() => onDelete(comment.id)}
            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 transition-colors"
            title="댓글 삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="mt-3 pl-13 text-slate-800 dark:text-slate-300 text-sm leading-relaxed">
        {comment.isDeleted ? (
          <span className="text-slate-400 dark:text-slate-500 italic">삭제된 댓글입니다.</span>
        ) : (
          <p className="whitespace-pre-wrap">{comment.content}</p>
        )}
      </div>

      {!comment.isDeleted && (
        <div className="mt-2 pl-13">
          <button
            onClick={onToggleReply}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            {isReplying ? '취소' : '답글 달기'}
          </button>
        </div>
      )}

      {isReplying && (
        <div className="mt-3 ml-12 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <textarea
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            placeholder="답글을 작성하세요..."
            rows={2}
            maxLength={COMMENT_MAX_LENGTH}
            className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onToggleReply}
              className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSubmitReply}
              disabled={!replyContent.trim() || submitting}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
            >
              답글 작성
            </button>
          </div>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 ml-8 md:ml-12 pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-4">
          {comment.replies.map((reply) => (
            <ReplyItem key={reply.id} reply={reply} canDelete={!reply.isDeleted && isMine(reply.userId)} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
};
