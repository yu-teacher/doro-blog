import React from 'react';
import type { TagItem } from '../../api/types';
import { Hash, Search, Tag as TagIcon } from 'lucide-react';

interface SearchPanelProps {
  isOpen: boolean;
  query: string;
  setQuery: (value: string) => void;
  suggestions: TagItem[];
  onSubmit: (e: React.FormEvent) => void;
  onSelectTag: (tagName: string) => void;
}

/** 헤더 아래로 펼쳐지는 검색 입력과 태그 추천. */
export const SearchPanel: React.FC<SearchPanelProps> = ({ isOpen, query, setQuery, suggestions, onSubmit, onSelectTag }) => (
  <>
    {/* Expandable Search Input */}
    {isOpen && (
      <div className="border-t border-gray-100 dark:border-slate-800 bg-gray-50/90 dark:bg-slate-900/90 px-4 py-3 animate-in slide-in-from-top-1">
        <div className="max-w-xl mx-auto">
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="검색어 또는 #태그 입력..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white shadow-2xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-2xs"
            >
              검색
            </button>
          </form>

          {/* Tag Autocomplete Suggestions Popover */}
          {suggestions.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 mr-1">
                <TagIcon className="w-3 h-3" /> 추천 태그:
              </span>
              {suggestions.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onSelectTag(tag.name)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all shadow-2xs"
                >
                  <Hash className="w-3 h-3 text-emerald-500" />
                  <span>{tag.name}</span>
                  <span className="opacity-50 text-[10px]">({tag.postCount})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
  </>
);
