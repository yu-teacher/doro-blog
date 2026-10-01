import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { PostSummary } from '../api/types';
import { PostCard } from '../components/PostCard';
import { Tag as TagIcon, Hash, X, Plus, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { ErrorState, LoadMoreError } from '../components/ErrorState';
import { trackEvent } from '../utils/analytics';
import { countTags } from '../utils/tags';
import { addSelectedTag, buildTagSearchParams, parseSelectedTags, removeSelectedTag } from '../utils/tagQuery';
import { useAsyncResource } from '../hooks/useAsyncResource';

const TAG_PAGE_SIZE = 15;
const CO_OCCURRING_TAGS_LIMIT = 15;

export const TagSearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // 주소에서 선택된 태그를 읽는다. 같은 태그 조합이면 같은 키라서 불필요한 재요청이 없다
  const tagsKey = parseSelectedTags(searchParams).join(',');
  const selectedTags = React.useMemo(() => (tagsKey ? tagsKey.split(',') : []), [tagsKey]);

  const sort = searchParams.get('sort') || 'latest';

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
    (page, signal) => blogApi.getFeed(sort, selectedTags, page, TAG_PAGE_SIZE, signal),
    [tagsKey, sort],
    {
      enabled: selectedTags.length > 0,
      onFirstPage: (res) => trackEvent('tag_search', { tags: tagsKey, sort, result_count: res.totalElements }),
    }
  );
  const popularTags = useAsyncResource((signal) => blogApi.getPopularTags(signal), []).data ?? [];

  // 함께 쓰인 태그: 현재 글에 쓰였지만 아직 선택하지 않은 태그
  const coOccurringTags = React.useMemo(
    () => countTags(posts, { lowercase: true, exclude: selectedTags, limit: CO_OCCURRING_TAGS_LIMIT }),
    [posts, selectedTags]
  );

  const sentinelRef = useInfiniteScroll({
    onIntersect: loadMore,
    enabled: hasMore && !loading && !loadingMore && !error,
  });

  const updateUrl = (tags: string[], newSort: string) => setSearchParams(buildTagSearchParams(tags, newSort));
  const handleAddTag = (tag: string) => updateUrl(addSelectedTag(selectedTags, tag), sort);
  const handleRemoveTag = (tag: string) => updateUrl(removeSelectedTag(selectedTags, tag), sort);
  const handleSortChange = (newSort: string) => updateUrl(selectedTags, newSort);

  return (
    <div className="max-w-[1728px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 mb-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6 mb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-2">
              <TagIcon className="w-4 h-4" />
              <span>태그 다중 교집합 검색</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <span>선택된 태그:</span>
              {selectedTags.length === 0 && <span className="text-slate-400 font-normal text-xl">선택된 태그 없음</span>}
            </h1>
          </div>

          {/* Sort Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => handleSortChange('latest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                sort === 'latest'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>최신순</span>
            </button>
            <button
              onClick={() => handleSortChange('popular')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                sort === 'popular'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>인기순</span>
            </button>
          </div>
        </div>

        {/* Selected Tags Chips (Active Filter Pills) */}
        <div className="flex flex-wrap items-center gap-2.5 mb-6">
          {selectedTags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-full text-sm font-bold shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <Hash className="w-3.5 h-3.5 opacity-80" />
              <span>{t}</span>
              <button
                onClick={() => handleRemoveTag(t)}
                className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors ml-0.5"
                title={`${t} 태그 제거`}
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </span>
          ))}

          {selectedTags.length > 0 && (
            <button
              onClick={() => updateUrl([], sort)}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 underline font-medium ml-2"
            >
              모든 태그 초기화
            </button>
          )}
        </div>

        {/* Co-Occurring / Related Tags (Filter Narrowing Recommendations) */}
        {selectedTags.length > 0 && coOccurringTags.length > 0 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5 text-emerald-500" />
              <span>함께 많이 쓰인 연관 태그로 결과 좁히기 (AND 결합):</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {coOccurringTags.map((co) => (
                <button
                  key={co.name}
                  onClick={() => handleAddTag(co.name)}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-full text-xs font-semibold border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
                >
                  <span>+ #{co.name}</span>
                  <span className="opacity-60 text-[10px]">({co.count})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* If no tags selected, show top popular tags to start with */}
        {selectedTags.length === 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-3">
              원하는 태그를 선택하여 포스트를 검색해 보세요:
            </p>
            <div className="flex flex-wrap gap-2">
              {popularTags.map((pt) => (
                <button
                  key={pt.id}
                  onClick={() => handleAddTag(pt.name)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-300 rounded-full text-xs font-semibold transition-all"
                >
                  <span>#{pt.name}</span>
                  <span className="opacity-70 text-[11px]">({pt.postCount})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedTags.length > 0 && !loading && (
          <div className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
            총 <span className="text-emerald-600 dark:text-emerald-400 font-bold">{totalElements}개</span>의 아티클이 일치합니다.
          </div>
        )}
      </div>

      {/* Post Grid */}
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
          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6 transition-opacity duration-200 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
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
            {error && <LoadMoreError message={error} onRetry={loadMore} />}
            {!hasMore && posts.length > 0 && (
              <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-600">
                <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  모든 일치 포스트를 불러왔습니다
                </span>
              </div>
            )}
          </div>
        </>
      ) : selectedTags.length > 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-slate-400 dark:text-slate-500 text-lg">
            선택된 모든 태그({selectedTags.map((t) => `#${t}`).join(', ')})를 동시에 만족하는 글이 없습니다.
          </p>
          <p className="text-slate-300 dark:text-slate-600 text-sm mt-2">
            연관 태그를 하나 제거하거나 다른 태그를 선택해 보세요.
          </p>
        </div>
      ) : null}
    </div>
  );
};
