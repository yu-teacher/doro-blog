import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { PostSummary } from '../api/types';
import { PostCard } from '../components/PostCard';
import { Search, Loader2, Tag as TagIcon } from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { ErrorState, LoadMoreError } from '../components/ErrorState';
import { trackEvent } from '../utils/analytics';
import { countTags } from '../utils/tags';

const SEARCH_PAGE_SIZE = 15;
const RELATED_TAGS_LIMIT = 12;

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [inputVal, setInputVal] = useState(query);
  const trimmedQuery = query.trim();

  const {
    items: posts,
    totalElements,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    reload,
  } = usePaginatedList<PostSummary>(
    (page, signal) => blogApi.searchPosts(trimmedQuery, page, SEARCH_PAGE_SIZE, signal),
    [trimmedQuery],
    {
      enabled: trimmedQuery.length > 0,
      onFirstPage: (res) => trackEvent('blog_search', { query: trimmedQuery, result_count: res.totalElements }),
    }
  );

  useEffect(() => {
    setInputVal(query);
  }, [query]);

  // 검색 결과 글에 많이 쓰인 태그를 연관 태그로 보여준다
  const relatedTags = useMemo(() => countTags(posts, { limit: RELATED_TAGS_LIMIT }), [posts]);

  const sentinelRef = useInfiniteScroll({
    onIntersect: loadMore,
    enabled: hasMore && !loading && !loadingMore && !error,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const params = new URLSearchParams();
    params.set('q', inputVal.trim());
    setSearchParams(params);
  };

  return (
    <div className="max-w-[1728px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Big Search Input */}
      <div className="max-w-2xl mx-auto mb-10">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            placeholder="검색어를 입력하세요 (제목, 내용, 태그)..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 text-base placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 shadow-xs transition-all"
          />
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-4 top-4" />
        </form>

        {query && (
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <strong className="text-slate-800 dark:text-slate-200">"{query}"</strong> 검색 결과{' '}
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{totalElements}건</span>
            </p>

            {/* Related Tags Bar */}
            {relatedTags.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 animate-in fade-in">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 mr-1">
                  <TagIcon className="w-3.5 h-3.5" /> 연관 태그:
                </span>
                {relatedTags.map((tag) => (
                  <Link
                    key={tag.name}
                    to={`/tags?tag=${encodeURIComponent(tag.name)}`}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-600 dark:text-slate-300 rounded-full text-xs font-semibold transition-all shadow-2xs"
                  >
                    <span>#{tag.name}</span>
                    <span className="opacity-60 text-[10px]">({tag.count})</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6 animate-pulse">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4" />
          ))}
        </div>
      ) : error && posts.length === 0 ? (
        <ErrorState message={error} onRetry={reload} />
      ) : posts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {/* Infinite Scroll Sentinel & Loading Indicator */}
          <div ref={sentinelRef} className="py-8 flex flex-col items-center justify-center">
            {loadingMore && (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-4">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span>검색 결과를 더 불러오는 중...</span>
              </div>
            )}
            {error && <LoadMoreError message={error} onRetry={loadMore} />}
            {!hasMore && posts.length > 0 && (
              <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-600">
                <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  모든 검색 결과를 불러왔습니다
                </span>
              </div>
            )}
          </div>
        </>
      ) : query ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-slate-400 dark:text-slate-500 text-lg">검색 결과가 없습니다.</p>
          <p className="text-slate-300 dark:text-slate-600 text-sm mt-1">다른 검색어를 입력해 보세요.</p>
        </div>
      ) : (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-slate-400 dark:text-slate-500">검색어를 입력하여 게시글을 찾아보세요.</p>
        </div>
      )}
    </div>
  );
};
