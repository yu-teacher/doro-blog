import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { PostSummary, TagItem } from '../api/types';
import { PostCard } from '../components/PostCard';
import { TrendingUp, Clock, Tag as TagIcon, Hash, Loader2, Rss, Bookmark, Heart, LogIn } from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useAuthStore } from '../store/authStore';

export const FeedPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, openLoginModal } = useAuthStore();
  const tab = searchParams.get('tab') || 'trending';
  const timeframe = searchParams.get('timeframe') || 'week';
  const selectedTag = searchParams.get('tag') || '';

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const res = await blogApi.getPopularTags();
      setTags(res || []);
    } catch (err) {
      console.error('Failed to fetch tags', err);
    }
  };

  // Initial load or tab/tag/timeframe change
  useEffect(() => {
    const fetchInitialPosts = async () => {
      setLoading(true);
      setPage(0);
      try {
        let res;
        if (selectedTag) {
          res = await blogApi.getPostsByTag(selectedTag, 0, 15);
        } else if (tab === 'trending') {
          res = await blogApi.getTrendingPosts(timeframe, 0, 15);
        } else if (tab === 'feed') {
          if (isAuthenticated) {
            res = await blogApi.getFollowingPosts(0, 15);
          } else {
            setPosts([]);
            setHasMore(false);
            setLoading(false);
            return;
          }
        } else if (tab === 'likes') {
          if (isAuthenticated) {
            res = await blogApi.getMyLikedPosts(0, 15);
          } else {
            setPosts([]);
            setHasMore(false);
            setLoading(false);
            return;
          }
        } else {
          res = await blogApi.getLatestPosts(0, 15);
        }
        setPosts(res.content || []);
        setHasMore(!res.last);
      } catch (err) {
        console.error('Failed to fetch posts', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialPosts();
  }, [tab, timeframe, selectedTag, isAuthenticated]);

  // Load more function for infinite scroll
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      let res;
      if (selectedTag) {
        res = await blogApi.getPostsByTag(selectedTag, nextPage, 15);
      } else if (tab === 'trending') {
        res = await blogApi.getTrendingPosts(timeframe, nextPage, 15);
      } else if (tab === 'feed') {
        if (!isAuthenticated) return;
        res = await blogApi.getFollowingPosts(nextPage, 15);
      } else if (tab === 'likes') {
        if (!isAuthenticated) return;
        res = await blogApi.getMyLikedPosts(nextPage, 15);
      } else {
        res = await blogApi.getLatestPosts(nextPage, 15);
      }
      setPosts((prev) => [...prev, ...res.content]);
      setPage(nextPage);
      setHasMore(!res.last);
    } catch (err) {
      console.error('Failed to load more posts', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, page, selectedTag, tab, timeframe, isAuthenticated]);

  const sentinelRef = useInfiniteScroll({
    onIntersect: loadMore,
    enabled: hasMore && !loading && !loadingMore,
  });

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams();
    params.set('tab', newTab);
    if (newTab === 'trending') {
      params.set('timeframe', timeframe);
    }
    setSearchParams(params);
  };

  const handleTimeframeChange = (newTf: string) => {
    const params = new URLSearchParams();
    params.set('tab', 'trending');
    params.set('timeframe', newTf);
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
    setSearchParams(params);
  };

  return (
    <div className="max-w-[1728px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header: Navigation Tabs & Timeframe Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-6 gap-4">
        {/* Left: Tab Selectors (Trending / Latest / Following Feed / Liked Archive) */}
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => handleTabChange('trending')}
            className={`flex items-center gap-2 pb-2 text-base sm:text-lg font-bold transition-all relative flex-shrink-0 ${
              !selectedTag && tab === 'trending'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span>트렌딩</span>
          </button>

          <button
            onClick={() => handleTabChange('latest')}
            className={`flex items-center gap-2 pb-2 text-base sm:text-lg font-bold transition-all relative flex-shrink-0 ${
              !selectedTag && tab === 'latest'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>최신</span>
          </button>

          <button
            onClick={() => handleTabChange('feed')}
            className={`flex items-center gap-2 pb-2 text-base sm:text-lg font-bold transition-all relative flex-shrink-0 ${
              !selectedTag && tab === 'feed'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Rss className="w-5 h-5" />
            <span>피드</span>
          </button>

          <button
            onClick={() => handleTabChange('likes')}
            className={`flex items-center gap-2 pb-2 text-base sm:text-lg font-bold transition-all relative flex-shrink-0 ${
              !selectedTag && tab === 'likes'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Bookmark className="w-5 h-5" />
            <span>관심 글</span>
          </button>

          {selectedTag && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-semibold border border-emerald-200 dark:border-emerald-800 flex-shrink-0">
              <Hash className="w-3.5 h-3.5" />
              <span>{selectedTag}</span>
              <button
                onClick={() => handleTagClick(selectedTag)}
                className="ml-1 text-emerald-500 hover:text-emerald-800 dark:hover:text-emerald-200"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Right: Timeframe Pills for Trending */}
        {!selectedTag && tab === 'trending' && (
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start sm:self-auto">
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
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 flex-shrink-0">
            <TagIcon className="w-3.5 h-3.5" /> 태그:
          </span>
          {tags.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTagClick(t.name)}
              className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 transition-colors ${
                selectedTag === t.name
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              #{t.name} <span className="opacity-70 ml-0.5">({t.postCount})</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800 p-4 animate-pulse h-80">
              <div className="bg-slate-200 dark:bg-slate-800 aspect-[16/9] rounded-xl mb-4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
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
                <span>글을 더 불러오는 중...</span>
              </div>
            )}
            {!hasMore && posts.length > 0 && (
              <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-600">
                <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  모든 포스트를 불러왔습니다
                </span>
              </div>
            )}
          </div>
        </>
      ) : tab === 'feed' && !isAuthenticated ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs max-w-lg mx-auto p-8">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <Rss className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">팔로우 피드는 로그인이 필요합니다</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            관심 있는 작가를 팔로우하고, 새로운 글이 올라올 때 피드에서 바로 확인해 보세요.
          </p>
          <button
            onClick={openLoginModal}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>DORO 로그인</span>
          </button>
        </div>
      ) : tab === 'feed' && isAuthenticated ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs max-w-lg mx-auto p-8">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <Rss className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">새로운 피드 글이 없습니다</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            아직 팔로우한 작가가 없거나, 팔로우한 작가의 새 글이 없습니다. 트렌딩에서 마음에 드는 작가를 팔로우해 보세요!
          </p>
          <button
            onClick={() => handleTabChange('trending')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            <span>트렌딩 피드 둘러보기</span>
          </button>
        </div>
      ) : tab === 'likes' && !isAuthenticated ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs max-w-lg mx-auto p-8">
          <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
            <Bookmark className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">관심 글 보관함은 로그인이 필요합니다</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            좋아요를 누른 글을 안전하게 보관하고 언제든지 다시 읽을 수 있습니다.
          </p>
          <button
            onClick={openLoginModal}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>DORO 로그인</span>
          </button>
        </div>
      ) : tab === 'likes' && isAuthenticated ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs max-w-lg mx-auto p-8">
          <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">좋아요한 관심 글이 없습니다</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            마음에 드는 유익한 글에 좋아요(하트)를 눌러 개인 관심사 보관함에 채워보세요!
          </p>
          <button
            onClick={() => handleTabChange('trending')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            <span>글 둘러보기</span>
          </button>
        </div>
      ) : (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <p className="text-slate-400 dark:text-slate-500 text-lg">작성된 게시글이 없습니다.</p>
          <p className="text-slate-300 dark:text-slate-600 text-sm mt-1">상단의 '새 글 작성' 버튼을 눌러 첫 글을 남겨보세요!</p>
        </div>
      )}

    </div>
  );
};
