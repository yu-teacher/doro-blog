import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { blogApi } from '../api/blogApi';
import type { Comment } from '../api/types';
import { MessageSquare, Send } from 'lucide-react';
import { trackEvent } from '../utils/analytics';
import { getErrorMessage } from '../utils/errors';
import { CommentItem } from './comments/CommentItem';
import { COMMENT_MAX_LENGTH, countComments } from './comments/commentUtils';
import { notify } from '../utils/notify';

interface CommentSectionProps {
  postId: string;
  comments: Comment[];
  onCommentUpdated: () => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  comments,
  onCommentUpdated,
}) => {
  const { user, isAuthenticated } = useAuthStore();
  const [rootContent, setRootContent] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalCount = countComments(comments);

  // 같은 댓글의 답글 버튼을 다시 누르면 입력창을 닫고, 다른 댓글이면 그 댓글로 옮기며 입력 내용을 비운다
  const toggleReply = (commentId: string) => {
    setReplyingToId(replyingToId === commentId ? null : commentId);
    setReplyContent('');
  };

  const handleCreateRootComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootContent.trim() || submitting) return;

    if (!isAuthenticated) {
      notify.info('댓글을 작성하려면 먼저 로그인해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await blogApi.createComment(postId, rootContent.trim());
      trackEvent('comment_submit', {
        post_id: postId,
        is_reply: false,
      });
      setRootContent('');
      onCommentUpdated();
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, '댓글 등록에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateReply = async (parentId: string) => {
    if (!replyContent.trim() || submitting) return;

    if (!isAuthenticated) {
      notify.info('답글을 작성하려면 먼저 로그인해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await blogApi.createComment(postId, replyContent.trim(), parentId);
      trackEvent('comment_submit', {
        post_id: postId,
        is_reply: true,
      });
      setReplyContent('');
      setReplyingToId(null);
      onCommentUpdated();
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, '답글 등록에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('정말로 이 댓글을 삭제하시겠습니까?')) return;

    try {
      await blogApi.deleteComment(commentId);
      onCommentUpdated();
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, '댓글 삭제 권한이 없거나 실패했습니다.'));
    }
  };

  return (
    <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800">
      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
        <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        <span>{totalCount}개의 댓글</span>
      </h3>

      {/* Root Comment Form */}
      <form onSubmit={handleCreateRootComment} className="mb-10">
        <textarea
          value={rootContent}
          onChange={(e) => setRootContent(e.target.value)}
          placeholder={
            isAuthenticated
              ? '댓글을 작성하세요. 건전한 소통 문화에 동참해 주세요 :)'
              : '로그인 후 댓글을 작성할 수 있습니다.'
          }
          disabled={!isAuthenticated}
          rows={3}
          maxLength={COMMENT_MAX_LENGTH}
          className="w-full p-4 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-600 text-sm md:text-base disabled:bg-slate-50 dark:disabled:bg-slate-950"
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={!isAuthenticated || !rootContent.trim() || submitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? '등록 중...' : '댓글 작성'}</span>
          </button>
        </div>
      </form>

      <div className="space-y-6">
        {comments.length === 0 ? (
          <p className="text-center text-slate-400 dark:text-slate-600 py-10 font-normal">
            아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
          </p>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              isReplying={replyingToId === comment.id}
              replyContent={replyContent}
              submitting={submitting}
              onReplyContentChange={setReplyContent}
              onToggleReply={() => toggleReply(comment.id)}
              onSubmitReply={() => handleCreateReply(comment.id)}
              onDelete={handleDeleteComment}
            />
          ))
        )}
      </div>
    </div>
  );
};
