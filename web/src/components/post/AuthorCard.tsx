import React from 'react';
import { Link } from 'react-router-dom';
import type { AuthorBio, PostSummary } from '../../api/types';
import { safeHttpUrl } from '../../utils/safeUrl';
import { Globe, Loader2, Mail, UserCheck, UserMinus, UserPlus } from 'lucide-react';

interface AuthorCardProps {
  post: PostSummary;
  author: AuthorBio | undefined;
  isAuthor: boolean;
  authorFollowing: boolean;
  followLoading: boolean;
  onToggleFollow: () => void;
}

/** 글 하단의 작성자 소개 카드와 팔로우 버튼. */
export const AuthorCard: React.FC<AuthorCardProps> = ({ post, author, isAuthor, authorFollowing, followLoading, onToggleFollow }) => (
  <>
    {/* Author Bio Card */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs mt-12">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Link to={`/@${post.username}`} className="flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xl overflow-hidden border border-emerald-200 dark:border-emerald-800">
            {post.profileImageUrl ? (
              <img src={post.profileImageUrl} alt={post.nickname} className="w-full h-full object-cover" />
            ) : (
              post.nickname[0]
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link to={`/@${post.username}`} className="font-bold text-slate-900 dark:text-slate-100 text-lg hover:underline truncate">
              {post.nickname}
            </Link>
            <span className="text-xs text-slate-400 dark:text-slate-500">@{post.username}</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
            {author?.bio || '지식을 기록하고 나누는 것을 즐기는 DORO 블로거입니다.'}
          </p>

          {/* Author Social Links */}
          <div className="flex items-center gap-3 mt-2 text-slate-400 dark:text-slate-500">
            {safeHttpUrl(author?.githubUrl) && (
              <a href={safeHttpUrl(author?.githubUrl)} target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-white transition-colors" title="GitHub">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
            )}
            {safeHttpUrl(author?.websiteUrl) && (
              <a href={safeHttpUrl(author?.websiteUrl)} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title="웹사이트">
                <Globe className="w-3.5 h-3.5" />
              </a>
            )}
            {author?.publicEmail && (
              <a href={`mailto:${author.publicEmail}`} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title={`이메일 (${author.publicEmail})`}>
                <Mail className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Follow Author Button (if not author) */}
      {!isAuthor && (
        <button
          disabled={followLoading}
          onClick={onToggleFollow}
          className={`group inline-flex items-center justify-center min-w-[84px] gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-xs flex-shrink-0 self-start sm:self-center cursor-pointer ${
            authorFollowing
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-900'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {followLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : authorFollowing ? (
            <>
              <UserCheck className="w-3.5 h-3.5 group-hover:hidden" />
              <UserMinus className="w-3.5 h-3.5 hidden group-hover:inline text-rose-600 dark:text-rose-400" />
              <span className="group-hover:hidden">팔로잉</span>
              <span className="hidden group-hover:inline text-rose-600 dark:text-rose-400">언팔로우</span>
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              <span>팔로우</span>
            </>
          )}
        </button>
      )}
    </div>
  </>
);
