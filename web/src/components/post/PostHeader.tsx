import React from 'react';
import { Link } from 'react-router-dom';
import type { PostSummary } from '../../api/types';
import { formatDate } from '../../utils/date';
import { Calendar, Edit3, Eye, Trash2 } from 'lucide-react';

interface PostHeaderProps {
  post: PostSummary;
  isAuthor: boolean;
  onDelete: () => void;
}

/** 글 제목, 작성자/날짜/조회수, 작성자용 수정·삭제 버튼, 태그. */
export const PostHeader: React.FC<PostHeaderProps> = ({ post, isAuthor, onDelete }) => (
  <>
    {/* Article Header */}
    <header className="mb-8">
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-slate-50 leading-tight tracking-tight mb-4">
        {post.title}
      </h1>

      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link to={`/@${post.username}`} className="font-bold text-slate-800 dark:text-slate-200 hover:underline">
            {post.nickname}
          </Link>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {formatDate(post.publishedAt, 'dateLong', '임시저장')}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" /> 조회 {post.viewCount}
          </span>
        </div>

        {/* Edit/Delete Actions for Author */}
        {isAuthor && (
          <div className="flex items-center gap-2">
            <Link
              to={`/edit/${post.id}`}
              className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 px-2 py-1 rounded transition-colors text-xs font-medium"
            >
              <Edit3 className="w-3.5 h-3.5" /> 수정
            </Link>
            <button
              onClick={onDelete}
              className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 px-2 py-1 rounded transition-colors text-xs font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" /> 삭제
            </button>
          </div>
        )}
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {post.tags.map((tag) => (
            <Link
              key={tag}
              to={`/?tag=${encodeURIComponent(tag)}`}
              className="text-xs font-semibold px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-full transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </header>
  </>
);
