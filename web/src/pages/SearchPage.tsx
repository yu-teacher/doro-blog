import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { PostSummary, PageResponse } from '../api/types';
import { PostCard } from '../components/PostCard';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '0', 10);

  const [inputVal, setInputVal] = useState(query);
  const [postsPage, setPostsPage] = useState<PageResponse<PostSummary> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInputVal(query);
    if (query.trim()) {
      handleSearch(query.trim(), page);
    } else {
      setPostsPage(null);
    }
  }, [query, page]);

  const handleSearch = async (q: string, p: number) => {
    setLoading(true);
    try {
      const res = await blogApi.searchPosts(q, p, 12);
      setPostsPage(res);

    } catch (err) {
      console.error('Failed to search posts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const params = new URLSearchParams();
    params.set('q', inputVal.trim());
    params.set('page', '0');
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-800 text-base placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs transition-all"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-4" />
        </form>

        {query && (
          <p className="text-sm text-slate-500 mt-3 text-center">
            <strong>"{query}"</strong> 검색 결과{' '}
            {postsPage && <span className="text-emerald-600 font-bold">{postsPage.totalElements}건</span>}
          </p>
        )}
      </div>

      {/* Search Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-80 bg-white rounded-xl border border-slate-100 p-4" />
          ))}
        </div>
      ) : postsPage && postsPage.content.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {postsPage.content.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {/* Pagination */}
          {postsPage.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={postsPage.first}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
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
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={postsPage.last}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      ) : query ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <p className="text-slate-400 text-lg">검색 결과가 없습니다.</p>
          <p className="text-slate-300 text-sm mt-1">다른 검색어를 입력해 보세요.</p>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <p className="text-slate-400">검색어를 입력하여 게시글을 찾아보세요.</p>
        </div>
      )}
    </div>
  );
};
