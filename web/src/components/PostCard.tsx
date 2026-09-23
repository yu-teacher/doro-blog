import React from 'react';
import { Link } from 'react-router-dom';
import { PostSummary } from '../api/types';
import { Heart, MessageSquare, BookOpen, Eye } from 'lucide-react';
import { stripMarkdown } from '../utils/markdown';
import { trackEvent } from '../utils/analytics';

interface PostCardProps {
  post: PostSummary;
  channelUsername?: string;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const PostCard: React.FC<PostCardProps> = ({ post, channelUsername }) => {
  const publishedDate = formatDate(post.publishedAt || post.createdAt);
  const authorName = post.nickname || post.username || '익명';
  const cleanSummary = stripMarkdown(post.summary) || '게시글 내용 미리보기가 제공되지 않습니다.';

  const getTagLink = (tag: string) => {
    return channelUsername ? `/@${channelUsername}?tag=${encodeURIComponent(tag)}` : `/tags?tag=${encodeURIComponent(tag)}`;
  };

  return (
    <article className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs hover:shadow-xl hover:border-emerald-200 dark:hover:border-slate-700 transition-all duration-300 flex flex-col overflow-hidden hover:-translate-y-1">
      {/* 1. Thumbnail */}
      <Link
        to={`/@${post.username}/${post.slug}`}
        onClick={() => {
          trackEvent('post_card_click', {
            post_id: post.id,
            title: post.title,
            author: post.username,
          });
        }}
        className="block relative aspect-[16/9] bg-slate-100 dark:bg-slate-800/80 overflow-hidden"
      >
        {post.thumbnailUrl ? (
          <img
            src={post.thumbnailUrl}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-slate-100 via-emerald-50/50 to-slate-200/80 dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-800 flex items-center justify-center p-6 text-center">
            <div className="flex flex-col items-center gap-1 select-none">
              <span className="text-3xl opacity-40">📄</span>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-600 font-mono tracking-wider">
                DORO BLOG
              </span>
            </div>
          </div>
        )}

        {/* Series Badge */}
        {post.seriesTitle && (
          <div className="absolute top-2.5 left-2.5 bg-emerald-600/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
            <BookOpen className="w-3 h-3" />
            <span className="truncate max-w-[140px]">{post.seriesTitle}</span>
          </div>
        )}
      </Link>

      {/* 2. Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <Link to={`/@${post.username}/${post.slug}`} className="block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug tracking-tight">
              {post.title}
            </h2>
          </Link>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed font-normal">
            {cleanSummary}
          </p>
        </div>

        <div>
          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 overflow-hidden max-h-12">
              {post.tags.slice(0, 4).map((tag) => (
                <Link
                  key={tag}
                  to={getTagLink(tag)}
                  onClick={(e) => e.stopPropagation()}
                  className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] rounded-md font-medium hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  #{tag}
                </Link>
              ))}
              {post.tags.length > 4 && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 px-1 py-0.5">
                  +{post.tags.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Sub-info: Date & Comments & Views */}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <span>{publishedDate}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>{post.commentCount}</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>{post.viewCount}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Card Footer (Author info on left, Likes on right) */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-900/50">
        {/* Author */}
        <Link
          to={`/@${post.username}`}
          className="flex items-center gap-2 min-w-0 max-w-[70%] group/author"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px] overflow-hidden border border-emerald-200/80 dark:border-emerald-800/80 flex-shrink-0">
            {post.profileImageUrl ? (
              <img src={post.profileImageUrl} alt={authorName} className="w-full h-full object-cover" />
            ) : (
              authorName.charAt(0).toUpperCase()
            )}
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
            by{' '}
            <strong className="font-semibold text-slate-800 dark:text-slate-200 group-hover/author:text-emerald-600 dark:group-hover/author:text-emerald-400 transition-colors">
              {authorName}
            </strong>
          </span>
        </Link>

        {/* Likes Count */}
        <div
          className="flex items-center gap-1.5 flex-shrink-0 text-slate-600 dark:text-slate-300 text-xs font-semibold"
          title={`좋아요 ${post.likeCount}개`}
        >
          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
          <span>{post.likeCount}</span>
        </div>
      </div>
    </article>
  );
};
