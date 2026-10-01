import React from 'react';
import type { PostSummary, UserTagSummary } from '../../api/types';
import { PostCard } from '../PostCard';
import { ErrorState, LoadMoreError } from '../ErrorState';
import { Loader2, Tag } from 'lucide-react';

interface PostsTabProps {
  cleanUsername: string;
  posts: PostSummary[];
  userTags: UserTagSummary[];
  totalPostCount: number;
  tagFilter: string;
  keyword: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  onTagClick: (tag: string) => void;
  onClearFilter: () => void;
  onLoadMore: () => void;
  onReload: () => void;
}

/** 글 탭: 태그 사이드바/칩, 필터 표시, 글 카드 그리드와 무한 스크롤. */
export const PostsTab: React.FC<PostsTabProps> = ({ cleanUsername, posts, userTags, totalPostCount, tagFilter, keyword, loading, loadingMore, hasMore, error, sentinelRef, onTagClick, onClearFilter, onLoadMore, onReload }) => (
  <>
    <div className="relative">
      {/* Outer Left Fixed Tag Sidebar (Desktop: >= 1280px / xl) */}
      {userTags.length > 0 && (
        <aside className="hidden xl:block absolute right-full mr-8 2xl:mr-12 top-0 h-full w-48 select-none">
          <div className="sticky top-28 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800">
              <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>태그 목록</span>
            </div>

            <div className="flex flex-col gap-1 max-h-[calc(100vh-160px)] overflow-y-auto text-xs pr-1">
              <button
                onClick={() => onTagClick('')}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium transition-colors ${
                  !tagFilter
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>전체보기</span>
                <span className="text-[11px] opacity-70 ml-2">({totalPostCount})</span>
              </button>

              {userTags.map((t) => {
                const isSelected = tagFilter === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => onTagClick(t.name)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">#{t.name}</span>
                    <span className="text-[11px] opacity-70 ml-2">({t.postCount})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      )}

      {/* Active Search/Filter Indicator */}
      {(keyword || tagFilter) && (
        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-4 py-2 rounded-lg text-sm mb-6 border border-emerald-100 dark:border-emerald-800">
          <span>
            {keyword && <>검색어 <strong>"{keyword}"</strong> </>}
            {tagFilter && <>태그 <strong>#{tagFilter}</strong> </>}
            결과
          </span>
          <button onClick={onClearFilter} className="text-xs text-emerald-700 dark:text-emerald-400 underline font-semibold">
            필터 초기화
          </button>
        </div>
      )}

      {/* Mobile / Tablet Horizontal Tag Chip Bar (< xl) */}
      {userTags.length > 0 && (
        <div className="xl:hidden mb-6 flex items-center gap-1.5 overflow-x-auto pb-2 text-xs">
          <button
            onClick={() => onTagClick('')}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-colors ${
              !tagFilter
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            전체보기 ({totalPostCount})
          </button>
          {userTags.map((t) => (
            <button
              key={t.name}
              onClick={() => onTagClick(t.name)}
              className={`px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-colors ${
                tagFilter === t.name
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              #{t.name} ({t.postCount})
            </button>
          ))}
        </div>
      )}

      {/* Main Posts Grid (Full Width) */}
      <main className="w-full">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-6" />
            ))}
          </div>
        ) : error && posts.length === 0 ? (
          <ErrorState message={error} onRetry={onReload} />
        ) : posts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} channelUsername={cleanUsername} />
              ))}
            </div>

            {/* Infinite Scroll Sentinel */}
            <div ref={sentinelRef} className="py-8 flex flex-col items-center justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <span>글을 더 불러오는 중...</span>
                </div>
              )}
              {error && <LoadMoreError message={error} onRetry={onLoadMore} />}
              {!hasMore && posts.length > 0 && (
                <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-600">
                  <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    모든 글을 불러왔습니다
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-slate-400 dark:text-slate-500">작성된 글이 없습니다.</p>
          </div>
        )}
      </main>
    </div>
      
  </>
);
