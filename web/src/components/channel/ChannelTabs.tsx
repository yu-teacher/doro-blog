import React from 'react';
import { BookOpen, Bookmark, FileText, Search, Sparkles } from 'lucide-react';

export type ChannelTab = 'posts' | 'series' | 'about' | 'likes';

interface ChannelTabsProps {
  currentTab: ChannelTab;
  isMyChannel: boolean;
  searchInput: string;
  setSearchInput: (value: string) => void;
  onTabChange: (tab: ChannelTab) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
}

/** 글 / 시리즈 / 소개 / 좋아요 탭 줄과 글 탭의 채널 내 검색 입력. */
export const ChannelTabs: React.FC<ChannelTabsProps> = ({ currentTab, isMyChannel, searchInput, setSearchInput, onTabChange, onSearchSubmit }) => (
  <>
    {/* 3 Main Tabs: 글 / 시리즈 / 소개 */}
    <div className="flex items-center justify-between mt-8 mb-6 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-8">
        <button
          onClick={() => onTabChange('posts')}
          className={`flex items-center gap-2 pb-3 text-lg font-bold transition-all relative ${
            currentTab === 'posts'
              ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>글</span>
        </button>

        <button
          onClick={() => onTabChange('series')}
          className={`flex items-center gap-2 pb-3 text-lg font-bold transition-all relative ${
            currentTab === 'series'
              ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span>시리즈</span>
        </button>

        <button
          onClick={() => onTabChange('about')}
          className={`flex items-center gap-2 pb-3 text-lg font-bold transition-all relative ${
            currentTab === 'about'
              ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>소개</span>
        </button>

        {isMyChannel && (
          <button
            onClick={() => onTabChange('likes')}
            className={`flex items-center gap-2 pb-3 text-lg font-bold transition-all relative ${
              currentTab === 'likes'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Bookmark className="w-5 h-5" />
            <span>관심 글</span>
          </button>
        )}
      </div>

      {/* In-channel search input (when on Posts tab) */}
      {currentTab === 'posts' && (
        <form onSubmit={onSearchSubmit} className="relative w-44 sm:w-60 pb-2">
          <input
            type="text"
            placeholder="블로그 내 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-full text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 border border-transparent focus:border-emerald-500 transition-all"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
        </form>
      )}
    </div>
  </>
);
