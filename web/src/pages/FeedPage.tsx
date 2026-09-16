import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { PostSummary, PageResponse, TagItem } from '../api/types';
import { PostCard } from '../components/PostCard';
import { TrendingUp, Clock, Tag as TagIcon, ChevronLeft, ChevronRight, Hash } from 'lucide-react';

export const FeedPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'trending';
  const timeframe = searchParams.get('timeframe') || 'week';
  const selectedTag = searchParams.get('tag') || '';
  const page = parseInt(searchParams.get('page') || '0', 10);

  const [postsPage, setPostsPage] = useState<PageResponse<PostSummary> | null>(null);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [tab, timeframe, selectedTag, page]);

  const fetchTags = async () => {
    try {
      const res = await blogApi.getPopularTags();
      setTags(res || []);
    } catch (err) {
      console.error('Failed to fetch tags', err);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let res;
      if (selectedTag) {
        res = await blogApi.getPostsByTag(selectedTag, page, 12);
      } else if (tab === 'trending') {
        res = await blogApi.getTrendingPosts(timeframe, page, 12);
      } else {
        res = await blogApi.getLatestPosts(page, 12);
      }
      setPostsPage(res);

    } catch (err) {
      console.error('Failed to fetch posts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams();
    params.set('tab', newTab);
    if (newTab === 'trending') {
      params.set('timeframe', timeframe);
    }
    params.set('page', '0');
    setSearchParams(params);
  };

  const handleTimeframeChange = (newTf: string) => {
    const params = new URLSearchParams();
    params.set('tab', 'trending');
    params.set('timeframe', newTf);
    params.set('page', '0');
    setSearchParams(params);
  };

  const handleTagClick = (tagName: string) => {
    const params = new URLSearchParams();
    if (selectedTag === tagName) {
      // Unselect tag
      params.set('tab', tab);
      if (tab === 'trending') params.set('timeframe', timeframe);
    } else {
      params.set('tag', tagName);
    }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header: Navigation Tabs & Timeframe Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 mb-6 gap-4">
        {/* Left: Tab Selectors (Trending / Latest) */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => handleTabChange('trending')}
            className={`flex items-center gap-2 pb-2 text-lg font-bold transition-all relative ${
              !selectedTag && tab === 'trending'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span>트렌딩</span>
          </button>

          <button
            onClick={() => handleTabChange('latest')}
            className={`flex items-center gap-2 pb-2 text-lg font-bold transition-all relative ${
              !selectedTag && tab === 'latest'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>최신</span>
          </button>

          {selectedTag && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-semibold border border-emerald-200">
              <Hash className="w-3.5 h-3.5" />
              <span>{selectedTag}</span>
              <button
                onClick={() => handleTagClick(selectedTag)}
                className="ml-1 text-emerald-500 hover:text-emerald-800"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Right: Timeframe Pills for Trending */}
        {!selectedTag && tab === 'trending' && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {[
              { id: 'day', label: '오늘' },
              { id: 'week', label: '이번 주' },
              { id: 'month', label: '이번 달' },
              { id: 'year', label: '올해' },
            ].map((tf) => (
              <button
                key={tf.id}
                onClick={() => handleTimeframeChange(tf.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  timeframe === tf.id
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Popular Tags Horizontal Bar */}
      {tags.length > 0 && (
        <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 flex-shrink-0">
            <TagIcon className="w-3.5 h-3.5" /> 태그:
          </span>
          {tags.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTagClick(t.name)}
              className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 transition-colors ${
                selectedTag === t.name
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              #{t.name} <span className="opacity-70 ml-0.5">({t.postCount})</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-xs border border-slate-100 p-4 animate-pulse h-80">
              <div className="bg-slate-200 h-44 rounded-lg mb-4" />
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : postsPage && postsPage.content.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {postsPage.content.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {/* Pagination Controls */}
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
                    className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                      page === idx
                        ? 'bg-emerald-600 text-white shadow-sm'
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
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-slate-400 text-lg">작성된 게시글이 없습니다.</p>
          <p className="text-slate-300 text-sm mt-1">상단의 '새 글 작성' 버튼을 눌러 첫 글을 남겨보세요!</p>
        </div>
      )}
    </div>
  );
};
