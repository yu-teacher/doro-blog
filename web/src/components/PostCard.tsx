import React from 'react';
import { Link } from 'react-router-dom';
import { PostSummary } from '../api/types';
import { Heart, MessageSquare, BookOpen } from 'lucide-react';

interface PostCardProps {
  post: PostSummary;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const publishedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date(post.createdAt).toLocaleDateString('ko-KR');

  return (
    <article className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800/80 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden hover:-translate-y-1">
      {/* Thumbnail */}
      <Link to={`/@${post.username}/${post.slug}`} className="block relative aspect-video bg-gray-100 dark:bg-slate-800 overflow-hidden group">
        {post.thumbnailUrl ? (
          <img
            src={post.thumbnailUrl}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-slate-800 dark:via-slate-800/70 dark:to-slate-900 flex items-center justify-center p-6 text-center">
            <span className="text-3xl opacity-30 select-none">📝</span>
          </div>
        )}

        {/* Series Badge */}
        {post.seriesTitle && (
          <div className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            <span className="truncate max-w-[140px]">{post.seriesTitle}</span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Title */}
          <Link to={`/@${post.username}/${post.slug}`} className="block group">
            <h2 className="font-bold text-lg text-gray-900 dark:text-slate-100 leading-snug group-hover:text-emerald-500 transition-colors line-clamp-2">
              {post.title}
            </h2>
          </Link>

          {/* Summary */}
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
            {post.summary || '게시글 요약이 없습니다.'}
          </p>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs rounded-md font-medium hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-5 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
          {/* Author */}
          <Link to={`/@${post.username}`} className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px] overflow-hidden border border-emerald-200 dark:border-emerald-800">
              {post.profileImageUrl ? (
                <img src={post.profileImageUrl} alt={post.nickname} className="w-full h-full object-cover" />
              ) : (
                post.nickname?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <span className="font-medium text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
              by <span className="font-semibold text-gray-900 dark:text-slate-200">{post.nickname}</span>
            </span>
            <span>·</span>
            <span>{publishedDate}</span>
          </Link>

          {/* Counts */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-gray-500 dark:text-slate-400">
              <Heart className="w-3.5 h-3.5 fill-red-400 text-red-400" />
              {post.likeCount}
            </span>
            <span className="flex items-center gap-1 text-gray-500 dark:text-slate-400">
              <MessageSquare className="w-3.5 h-3.5" />
              {post.commentCount}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};
