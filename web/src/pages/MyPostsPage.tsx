import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import { useAuthStore } from '../store/authStore';
import type { PostSummary, PageResponse, PostStatus } from '../api/types';
import { PostCard } from '../components/PostCard';
import {
  FileText,
  FileEdit,
  Lock,
  Heart,
  Edit3,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const MyPostsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const tab = searchParams.get('tab') || 'published'; // 'published' | 'draft' | 'private' | 'likes'
  const page = parseInt(searchParams.get('page') || '0', 10);

  const [postsPage, setPostsPage] = useState<PageResponse<PostSummary> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      alert('로그인이 필요한 페이지입니다.');
      navigate('/');
      return;
    }

    loadPosts();
  }, [tab, page, isAuthenticated]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      let res;
      if (tab === 'likes') {
        res = await blogApi.getMyLikedPosts(page, 10);
      } else {
        const statusMap: Record<string, PostStatus> = {
          published: 'PUBLISHED',
          draft: 'DRAFT',
          private: 'PRIVATE',
        };
        res = await blogApi.getMyPosts(statusMap[tab] || 'PUBLISHED', page, 10);
      }
      setPostsPage(res);
    } catch (err) {
      console.error('Failed to load my posts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('정말로 이 글을 삭제하시겠습니까?')) return;
    try {
      await blogApi.deletePost(id);
      loadPosts();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || '삭제에 실패했습니다.');
    }
  };

  const handleTabChange = (newTab: string) => {
    const p = new URLSearchParams();
    p.set('tab', newTab);
    p.set('page', '0');
    setSearchParams(p);
  };

  const handlePageChange = (newPage: number) => {
    const p = new URLSearchParams(searchParams);
    p.set('page', newPage.toString());
    setSearchParams(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      ) : tab === 'likes' ? (
        // Liked Posts view (rendered with PostCard grid)
        postsPage && postsPage.content.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {postsPage.content.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {postsPage.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={postsPage.first}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(postsPage.totalPages)].map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePageChange(idx)}
                      className={`w-9 h-9 rounded-lg text-sm font-semibold ${
                        page === idx
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={postsPage.last}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-slate-400 dark:text-slate-500">좋아요를 누른 포스트가 없습니다.</p>
          </div>
        )
      ) : (
        // Author's post list with management controls
        postsPage && postsPage.content.length > 0 ? (
          <>
            <div className="space-y-4">
              {postsPage.content.map((post) => (
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
                      작성일: {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                      {post.publishedAt && ` · 출간일: ${new Date(post.publishedAt).toLocaleDateString('ko-KR')}`}
                      {` · 조회 ${post.viewCount} · 좋아요 ${post.likeCount} · 댓글 ${post.commentCount}`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {post.status !== 'DRAFT' && (
                      <Link
                        to={`/@${post.username}/${post.slug}`}
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
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {postsPage.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={postsPage.first}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(postsPage.totalPages)].map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePageChange(idx)}
                      className={`w-9 h-9 rounded-lg text-sm font-semibold ${
                        page === idx
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={postsPage.last}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
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
