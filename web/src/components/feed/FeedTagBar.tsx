import React from 'react';
import type { FeedTag } from '../../utils/tags';
import type { HorizontalScroll } from '../../hooks/useHorizontalScroll';
import { ChevronLeft, ChevronRight, Tag as TagIcon } from 'lucide-react';

interface FeedTagBarProps {
  activeTags: FeedTag[];
  selectedTag: string;
  scroll: HorizontalScroll;
  onTagClick: (tag: string) => void;
}

/** 가로로 스크롤되는 태그 줄(좌우 화살표와 페이드 포함). */
export const FeedTagBar: React.FC<FeedTagBarProps> = ({ activeTags, selectedTag, scroll, onTagClick }) => (
  <>
    {/* Popular Tags Horizontal Bar with Smooth Scroll & Edge Fades */}
    {activeTags.length > 0 && (
      <div className="relative mb-8 group">
        {/* Left Arrow Button & Fade */}
        {scroll.canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pr-6 bg-gradient-to-r from-white via-white/80 to-transparent dark:from-slate-900 dark:via-slate-900/80 dark:to-transparent">
            <button
              onClick={() => scroll.scrollBy('left')}
              className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:scale-110 transition-all"
              aria-label="이전 태그 보기"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tags Scrollable Container */}
        <div
          ref={scroll.ref}
          onScroll={scroll.update}
          className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none scroll-smooth"
        >
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 flex-shrink-0 mr-1">
            <TagIcon className="w-3.5 h-3.5" /> 태그:
          </span>
          {activeTags.map((t) => (
            <button
              key={t.id}
              onClick={() => onTagClick(t.name)}
              className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 transition-all ${
                selectedTag === t.name
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              #{t.name} <span className="opacity-70 ml-0.5 font-mono text-[11px]">({t.postCount})</span>
            </button>
          ))}
        </div>

        {/* Right Arrow Button & Fade */}
        {scroll.canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pl-6 bg-gradient-to-l from-white via-white/80 to-transparent dark:from-slate-900 dark:via-slate-900/80 dark:to-transparent">
            <button
              onClick={() => scroll.scrollBy('right')}
              className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:scale-110 transition-all"
              aria-label="다음 태그 보기"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    )}
  </>
);
