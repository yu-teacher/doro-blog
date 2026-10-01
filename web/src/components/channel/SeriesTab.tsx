import React from 'react';
import { Link } from 'react-router-dom';
import type { Series } from '../../api/types';
import { formatDate } from '../../utils/date';
import {  } from 'lucide-react';

interface SeriesTabProps {
  cleanUsername: string;
  seriesList: Series[];
  loading: boolean;
}

/** 채널의 시리즈 목록 탭. */
export const SeriesTab: React.FC<SeriesTabProps> = ({ cleanUsername, seriesList, loading }) => (
  <>
    <div>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-pulse">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-44 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-6" />
          ))}
        </div>
      ) : seriesList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {seriesList.map((series) => (
            <Link
              key={series.id}
              to={`/@${cleanUsername}/series/${series.slug}`}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-md dark:hover:border-slate-700 transition-all group flex flex-col justify-between"
            >
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-2">
                  {series.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                  {series.description || '시리즈 설명이 없습니다.'}
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{series.postCount}개의 포스트</span>
                <span>최근 업데이트: {formatDate(series.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-slate-400 dark:text-slate-500">등록된 시리즈가 없습니다.</p>
        </div>
      )}
    </div>
      
  </>
);
