import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { PostSummary } from '../api/types';
import { PostCard } from '../components/PostCard';
import { Search, Loader2 } from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [inputVal, setInputVal] = useState(query);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setInputVal(query);
    if (!query.trim()) {
      setPosts([]);
      setTotalElements(0);
      setHasMore(false);
      return;
    }

    const fetchInitial = async () => {
      setLoading(true);
      setPage(0);
      try {
        const res = await blogApi.searchPosts(query.trim(), 0, 12);
        setPosts(res.content || []);
        setTotalElements(res.totalElements);
        setHasMore(!res.last);
      } catch (err) {
        console.error('Failed to search posts', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();
  }, [query]);

  const loadMore = useCallback(async () => {
    if (!query.trim() || loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await blogApi.searchPosts(query.trim(), nextPage, 12);
      setPosts((prev) => [...prev, ...res.content]);
      setPage(nextPage);
      setHasMore(!res.last);
    } catch (err) {
      console.error('Failed to load more search results', err);
    } finally {
      setLoadingMore(false);
    }
  }, [query, loading, loadingMore, hasMore, page]);

  const sentinelRef = useInfiniteScroll({
    onIntersect: loadMore,
    enabled: hasMore && !loading && !loadingMore,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const params = new URLSearchParams();
    params.set('q', inputVal.trim());
    setSearchParams(params);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Big Search Input */}
      <div className="max-w-2xl mx-auto mb-12">
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
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 text-center">
            <strong className="text-slate-800 dark:text-slate-200">"{query}"</strong> 검색 결과{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{totalElements}건</span>
          </p>
        )}
      </div>

      {/* Search Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-80 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4" />
          ))}
        </div>
      ) : posts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
