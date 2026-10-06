import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { PostSummary, TagItem } from '../api/types';
import { PostCard } from '../components/PostCard';
import { FeedTabs } from '../components/feed/FeedTabs';
import { FeedTagBar } from '../components/feed/FeedTagBar';
import { TrendingUp, Loader2, Rss, Bookmark, Heart, LogIn } from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useHorizontalScroll } from '../hooks/useHorizontalScroll';
import { deriveFeedTags, type FeedTag } from '../utils/tags';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { ErrorState, LoadMoreError } from '../components/ErrorState';
import { useAuthStore } from '../store/authStore';

const FEED_PAGE_SIZE = 15;
const NO_TAGS: readonly TagItem[] = [];

export const FeedPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();
  const tab = searchParams.get('tab') || 'trending';
  const timeframe = searchParams.get('timeframe') || 'week';
  const selectedTag = searchParams.get('tag') || '';

  // 로그인이 필요한 탭(구독/좋아요)은 비로그인 상태에서 요청하지 않는다
  const requiresLogin = !selectedTag && (tab === 'feed' || tab === 'likes');
  const fetchEnabled = !requiresLogin || isAuthenticated;

  const {
    items: posts,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    reload,
  } = usePaginatedList<PostSummary>(
    (page, signal) => {
      if (selectedTag) return blogApi.getPostsByTag(selectedTag, page, FEED_PAGE_SIZE, signal);
      if (tab === 'trending') return blogApi.getTrendingPosts(timeframe, page, FEED_PAGE_SIZE, signal);
      if (tab === 'feed') return blogApi.getFollowingPosts(page, FEED_PAGE_SIZE, signal);
      if (tab === 'likes') return blogApi.getMyLikedPosts(page, FEED_PAGE_SIZE, signal);
      return blogApi.getLatestPosts(page, FEED_PAGE_SIZE, signal);
    },
    [tab, timeframe, selectedTag, isAuthenticated],
    { enabled: fetchEnabled }
  );

  // 전체 인기 태그 (현재 글에 쓰인 태그가 없을 때 태그 줄을 채운다)
  const popularTags = useAsyncResource((signal) => blogApi.getPopularTags(signal), []);

  // 태그를 눌러 필터링해도 태그 줄이 전체 인기 태그로 되돌아가지 않도록, 필터 전의 태그 줄을 기억해 둔다
  const computedTags = React.useMemo(() => deriveFeedTags(posts, popularTags.data ?? NO_TAGS, tab), [posts, popularTags.data, tab]);
  const [rememberedTags, setRememberedTags] = useState<FeedTag[]>([]);
  useEffect(() => {
    if (!selectedTag || rememberedTags.length === 0) setRememberedTags(computedTags);
  }, [computedTags, selectedTag, rememberedTags.length]);
  const activeTags = selectedTag && rememberedTags.length > 0 ? rememberedTags : computedTags;

  const tagBar = useHorizontalScroll([activeTags]);

  const sentinelRef = useInfiniteScroll({
    onIntersect: loadMore,
    enabled: hasMore && !loading && !loadingMore && !error,
  });

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams();
    params.set('tab', newTab);
    if (newTab === 'trending') {
      params.set('timeframe', timeframe);
    }
    // Clear tag filter on explicit tab switch so the user gets the clean feed
    setSearchParams(params);
  };

  const handleTimeframeChange = (newTf: string) => {
    const params = new URLSearchParams();
    params.set('tab', 'trending');
    params.set('timeframe', newTf);
    setSearchParams(params);
  };

  const handleTagClick = (tagName: string) => {
    navigate(`/tags?tag=${encodeURIComponent(tagName)}`);
  };

  return (
    <div className="max-w-[1728px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <FeedTabs
        tab={tab}
        timeframe={timeframe}
        selectedTag={selectedTag}
        onTabChange={handleTabChange}
        onTimeframeChange={handleTimeframeChange}
        onTagClick={handleTagClick}
      />

      <FeedTagBar activeTags={activeTags} selectedTag={selectedTag} scroll={tagBar} onTagClick={handleTagClick} />

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
                <span>글을 더 불러오는 중...</span>
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
            onClick={login}
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
            onClick={login}
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
