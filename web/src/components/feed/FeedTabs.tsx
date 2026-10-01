import React from 'react';
import { TrendingUp, Clock, Hash, Rss, Bookmark } from 'lucide-react';

interface FeedTabsProps {
  tab: string;
  timeframe: string;
  selectedTag: string;
  onTabChange: (tab: string) => void;
  onTimeframeChange: (timeframe: string) => void;
  /** 선택된 태그 배지를 눌렀을 때 (태그 검색 화면으로 이동). */
  onTagClick: (tag: string) => void;
}

/** 피드 상단: 트렌딩/최신/구독/좋아요 탭, 트렌딩 기간 선택, 선택된 태그 배지. */
export const FeedTabs: React.FC<FeedTabsProps> = ({ tab, timeframe, selectedTag, onTabChange, onTimeframeChange, onTagClick }) => (
  <>
    {/* Top Header: Navigation Tabs & Timeframe Selection */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-6 gap-4">
      {/* Left: Tab Selectors (Trending / Latest / Following Feed / Liked Archive) */}
      <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => onTabChange('trending')}
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
          onClick={() => onTabChange('latest')}
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
          onClick={() => onTabChange('feed')}
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
          onClick={() => onTabChange('likes')}
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
              onClick={() => onTagClick(selectedTag)}
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
              onClick={() => onTimeframeChange(tf.id)}
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
  </>
);
