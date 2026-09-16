import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { blogApi } from '../api/blogApi';
import type { Comment } from '../api/types';
import { MessageSquare, CornerDownRight, Trash2, Send } from 'lucide-react';

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

  // Calculate total comment count including replies
  const totalCount = comments.reduce((acc, curr) => acc + 1 + (curr.replies?.length || 0), 0);

  const handleCreateRootComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootContent.trim() || submitting) return;

    if (!isAuthenticated) {
      alert('댓글을 작성하려면 먼저 로그인해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await blogApi.createComment(postId, rootContent.trim());
      setRootContent('');
      onCommentUpdated();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || '댓글 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateReply = async (parentId: string) => {
    if (!replyContent.trim() || submitting) return;

    if (!isAuthenticated) {
      alert('답글을 작성하려면 먼저 로그인해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await blogApi.createComment(postId, replyContent.trim(), parentId);
      setReplyContent('');
      setReplyingToId(null);
      onCommentUpdated();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || '답글 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('정말로 이 댓글을 삭제하시겠습니까?')) return;

    try {
      await blogApi.deleteComment(commentId);
      onCommentUpdated();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || '댓글 삭제 권한이 없거나 실패했습니다.');
    }
  };

  return (
    <div className="mt-16 pt-8 border-t border-slate-200">
      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-6">
        <MessageSquare className="w-5 h-5 text-emerald-600" />
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
          className="w-full p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-slate-800 bg-white placeholder:text-slate-400 text-sm md:text-base disabled:bg-slate-50"
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

      {/* Comment List */}
      <div className="space-y-6">
        {comments.length === 0 ? (
          <p className="text-center text-slate-400 py-10 font-normal">
            아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="border-b border-slate-100 pb-6 last:border-0">
              {/* Root Comment Item */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm overflow-hidden">
                    {comment.profileImageUrl ? (
                      <img src={comment.profileImageUrl} alt={comment.nickname} className="w-full h-full object-cover" />
                    ) : (
                      comment.nickname[0]
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 text-sm">{comment.nickname}</span>
                    <span className="text-xs text-slate-400 ml-2">@{comment.username}</span>
                    <p className="text-xs text-slate-400">
                      {new Date(comment.createdAt).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                {/* Delete button (if user matches or guard allows) */}
                {!comment.isDeleted && user && user.id === comment.userId && (
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                    title="댓글 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Comment Content or Deleted Placeholder */}
              <div className="mt-3 pl-13 text-slate-800 text-sm leading-relaxed">
                {comment.isDeleted ? (
                  <span className="text-slate-400 italic">삭제된 댓글입니다.</span>
                ) : (
                  <p className="whitespace-pre-wrap">{comment.content}</p>
                )}
              </div>

              {/* Reply toggle button */}
              {!comment.isDeleted && (
                <div className="mt-2 pl-13">
                  <button
                    onClick={() => {
                      if (replyingToId === comment.id) {
                        setReplyingToId(null);
                        setReplyContent('');
                      } else {
                        setReplyingToId(comment.id);
                        setReplyContent('');
                      }
                    }}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    {replyingToId === comment.id ? '취소' : '답글 달기'}
                  </button>
                </div>
              )}

              {/* Reply Input Box */}
              {replyingToId === comment.id && (
                <div className="mt-3 ml-12 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="답글을 작성하세요..."
                    rows={2}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setReplyingToId(null)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCreateReply(comment.id)}
                      disabled={!replyContent.trim() || submitting}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      답글 작성
                    </button>
                  </div>
                </div>
              )}

              {/* Replies (2nd Level) */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="mt-4 ml-8 md:ml-12 pl-4 border-l-2 border-slate-200 space-y-4">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="pt-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs overflow-hidden">
                            {reply.profileImageUrl ? (
                              <img src={reply.profileImageUrl} alt={reply.nickname} className="w-full h-full object-cover" />
                            ) : (
                              reply.nickname[0]
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 text-xs">{reply.nickname}</span>
                            <span className="text-[11px] text-slate-400 ml-1.5">@{reply.username}</span>
                            <span className="text-[11px] text-slate-400 ml-2">
                              {new Date(reply.createdAt).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>

                        {!reply.isDeleted && user && user.id === reply.userId && (
                          <button
                            onClick={() => handleDeleteComment(reply.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                            title="답글 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-1.5 pl-6 text-slate-800 text-xs leading-relaxed">
                        {reply.isDeleted ? (
                          <span className="text-slate-400 italic">삭제된 댓글입니다.</span>
                        ) : (
                          <p className="whitespace-pre-wrap">{reply.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
