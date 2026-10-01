import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { ErrorState } from '../components/ErrorState';
import { BookOpen, Calendar, ArrowLeft, Lock } from 'lucide-react';

export const SeriesDetailPage: React.FC = () => {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const cleanUsername = username?.startsWith('@') ? username.substring(1) : username;

  const { data: seriesDetail, loading, error, reload } = useAsyncResource(
    (signal) => blogApi.getSeriesBySlug(cleanUsername ?? '', slug ?? '', signal),
    [cleanUsername, slug],
    { enabled: Boolean(cleanUsername && slug) }
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3 mb-4" />
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-10" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-100 p-4" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !seriesDetail) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }

  if (!seriesDetail) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">시리즈를 찾을 수 없습니다</h2>
        <Link
          to={`/@${cleanUsername}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 mt-4"
        >
          <ArrowLeft className="w-4 h-4" /> 블로그 홈으로 이동
        </Link>
      </div>
    );
  }

  const { series, posts } = seriesDetail;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Series Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-8 mb-8">
        <Link
          to={`/@${cleanUsername}?tab=series`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> @{cleanUsername}의 시리즈 목록
        </Link>

        <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-bold mb-2">
          <BookOpen className="w-6 h-6" />
          <span className="text-sm uppercase tracking-wider">SERIES</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-4">{series.title}</h1>
        {series.description && <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{series.description}</p>}

        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span className="font-semibold text-slate-700 dark:text-slate-300">총 {series.postCount}화</span>
          <span>·</span>
          <span>마지막 업데이트 {new Date(series.updatedAt).toLocaleDateString('ko-KR')}</span>
        </div>
      </div>

      {/* Series Posts List */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <p className="text-center text-slate-400 dark:text-slate-500 py-12">시리즈에 아직 등록된 포스트가 없습니다.</p>
        ) : (
          posts.map((post, idx) => (
            <Link
              key={post.id}
              to={`/@${cleanUsername}/${post.slug}`}
              className="flex items-start gap-5 p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-sm transition-all group"
            >
              <div className="w-10 text-xl font-bold text-slate-300 dark:text-slate-700 group-hover:text-emerald-500 flex-shrink-0 pt-1">
                {String(idx + 1).padStart(2, '0')}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-500 transition-colors">
                    {post.title}
                  </h3>
                  {post.status === 'PRIVATE' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <Lock className="w-3 h-3" /> 비공개
                    </span>
                  )}
                  {post.status === 'DRAFT' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                      임시저장
                    </span>
                  )}
                </div>
                {post.summary && <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{post.summary}</p>}
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString('ko-KR')
                      : '미출간'}
                  </span>
                </div>
              </div>

              {post.thumbnailUrl && (
                <div className="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800 hidden sm:block">
                  <img src={post.thumbnailUrl} alt={post.title} className="w-full h-full object-cover" />
                </div>
              )}
            </Link>
          ))
        )}
      </div>
    </div>

  );
};
