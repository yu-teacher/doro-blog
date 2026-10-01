import React from 'react';
import { Link } from 'react-router-dom';
import type { PostSummary, SeriesDetail } from '../../api/types';
import { BookOpen } from 'lucide-react';

interface SeriesInfoBoxProps {
  post: PostSummary;
  seriesDetail: SeriesDetail | null;
}

/** 글이 속한 시리즈 정보와 같은 시리즈의 글 목차. */
export const SeriesInfoBox: React.FC<SeriesInfoBoxProps> = ({ post, seriesDetail }) => (
  <>
    {/* Series Info Box (Velog style) */}
    {seriesDetail && (
      <div className="mb-8 p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold mb-3 text-base">
          <BookOpen className="w-5 h-5" />
          <Link to={`/@${post.username}/series/${seriesDetail.series.slug}`} className="hover:underline">
            {seriesDetail.series.title}
          </Link>
        </div>
        <ol className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
          {seriesDetail.posts.map((p, idx) => {
            const isCurrent = p.id === post.id;
            return (
              <li key={p.id} className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${isCurrent ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                  {idx + 1}.
                </span>
                {isCurrent ? (
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold">{p.title} (현재 글)</span>
                ) : (
                  <Link to={`/@${post.username}/${p.slug}`} className="hover:text-slate-900 dark:hover:text-slate-200 hover:underline truncate">
                    {p.title}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    )}
  </>
);
