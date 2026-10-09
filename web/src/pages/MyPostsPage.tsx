import React, { useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import { useAuthStore } from '../store/authStore';
import type { PostSummary, PostStatus } from '../api/types';
import { PostCard } from '../components/PostCard';
import {
  FileText,
  FileEdit,
  Lock,
  Heart,
  Edit3,
  Trash2,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { ErrorState, LoadMoreError } from '../components/ErrorState';
import { getErrorMessage } from '../utils/errors';
import { formatDate } from '../utils/date';
import { notify } from '../utils/notify';

const MY_POSTS_PAGE_SIZE = 10;

const STATUS_BY_TAB: Record<string, PostStatus> = {
  published: 'PUBLISHED',
  draft: 'DRAFT',
  private: 'PRIVATE',
};

export const MyPostsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const tab = searchParams.get('tab') || 'published'; // 'published' | 'draft' | 'private' | 'likes'

  const {
    items: posts,
    setItems: setPosts,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    reload,
  } = usePaginatedList<PostSummary>(
    (page, signal) =>
      tab === 'likes'
        ? blogApi.getMyLikedPosts(page, MY_POSTS_PAGE_SIZE, signal)
        : blogApi.getMyPosts(STATUS_BY_TAB[tab] ?? 'PUBLISHED', page, MY_POSTS_PAGE_SIZE, signal),
    [tab],
    { enabled: isAuthenticated }
  );

  useEffect(() => {
    if (!isAuthenticated) {
      notify.info('로그인이 필요한 페이지입니다.');
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const sentinelRef = useInfiniteScroll({
    onIntersect: loadMore,
    enabled: hasMore && !loading && !loadingMore && !error,
  });

  const handleDeletePost = async (id: string) => {
    if (!confirm('정말로 이 글을 삭제하시겠습니까?')) return;
    try {
      await blogApi.deletePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, '삭제에 실패했습니다.'));
    }
  };

  const handleTabChange = (newTab: string) => {
    const p = new URLSearchParams();
    p.set('tab', newTab);
    setSearchParams(p);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-8">내 포스트 관리</h1>

      {/* Management Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto">
        {[
          { id: 'published', label: '출간한 글', icon: FileText },
          { id: 'draft', label: '임시 글', icon: FileEdit },
          { id: 'private', label: '비공개 글', icon: Lock },
          { id: 'likes', label: '좋아요한 글', icon: Heart },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`flex items-center gap-2 pb-3 text-sm sm:text-base font-bold transition-all relative flex-shrink-0 ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-6" />
          ))}
        </div>
      ) : error && posts.length === 0 ? (
        <ErrorState message={error} onRetry={reload} />
      ) : tab === 'likes' ? (
        // Liked Posts view (rendered with PostCard grid)
        posts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {/* Infinite Scroll Sentinel & Loading Indicator */}
            <div ref={sentinelRef} className="py-8 flex flex-col items-center justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <span>포스트를 더 불러오는 중...</span>
                </div>
              )}
              {error && <LoadMoreError message={error} onRetry={loadMore} />}
              {!hasMore && posts.length > 0 && (
                <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-600">
                  <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    모든 포스트를 불러왔습니다
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-slate-400 dark:text-slate-500">좋아요를 누른 포스트가 없습니다.</p>
          </div>
        )
      ) : (
        // Author's post list with management controls
        posts.length > 0 ? (
          <>
            <div className="space-y-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {post.status === 'DRAFT' && (
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded">
                          임시저장
                        </span>
                      )}
                      {post.status === 'PRIVATE' && (
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded">
                          비공개
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{post.title}</h3>
                    </div>

                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      작성일: {formatDate(post.createdAt)}
                      {post.publishedAt && ` · 출간일: ${formatDate(post.publishedAt)}`}
                      {` · 조회 ${post.viewCount} · 좋아요 ${post.likeCount} · 댓글 ${post.commentCount}`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {post.status !== 'DRAFT' && (
                      <Link
                        to={`/@${post.username}/${encodeURIComponent(post.slug)}`}
                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="글 보기"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    )}
                    <Link
                      to={`/edit/${post.id}`}
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="글 수정"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                      title="글 삭제"
                      aria-label="글 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Infinite Scroll Sentinel & Loading Indicator */}
            <div ref={sentinelRef} className="py-8 flex flex-col items-center justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <span>포스트를 더 불러오는 중...</span>
                </div>
              )}
              {error && <LoadMoreError message={error} onRetry={loadMore} />}
              {!hasMore && posts.length > 0 && (
                <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-600">
                  <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    모든 포스트를 불러왔습니다
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-slate-400 dark:text-slate-500">해당 상태의 포스트가 없습니다.</p>
          </div>
        )
      )}
    </div>
  );
};
