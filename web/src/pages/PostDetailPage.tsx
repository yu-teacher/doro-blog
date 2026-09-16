import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import { useAuthStore } from '../store/authStore';
import type { PostDetail, Comment, SeriesDetail } from '../api/types';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { CommentSection } from '../components/CommentSection';
import {
  Heart,
  Share2,
  Bookmark,
  Calendar,
  Eye,
  Edit3,
  Trash2,
  BookOpen,
  ArrowLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-react';

export const PostDetailPage: React.FC = () => {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [seriesDetail, setSeriesDetail] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [copied, setCopied] = useState(false);

  // Clean username if prefixed with @
  const cleanUsername = username?.startsWith('@') ? username.substring(1) : username;

  useEffect(() => {
    if (cleanUsername && slug) {
      loadPost();
    }
  }, [cleanUsername, slug]);

  const loadPost = async () => {
    if (!cleanUsername || !slug) return;
    setLoading(true);
    try {
      const postData = await blogApi.getPostBySlug(cleanUsername, slug);
      setDetail(postData);
      setLikeCount(postData.post.likeCount);
      setIsLiked(postData.likedByMe);

      // Load comments
      loadComments(postData.post.id);

      // Load series if post belongs to series
      if (postData.post.seriesId) {
        try {
          const sRes = await blogApi.getSeries(postData.post.seriesId);
          setSeriesDetail(sRes);
        } catch (sErr) {
          console.error('Failed to load series', sErr);
        }
      }
    } catch (err) {
      console.error('Failed to load post', err);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      const cRes = await blogApi.getComments(postId);
      setComments(cRes || []);
    } catch (err) {
      console.error('Failed to load comments', err);
    }
  };


  const handleToggleLike = async () => {
    if (!detail) return;
    try {
      if (isLiked) {
        await blogApi.unlikePost(detail.post.id);
        setIsLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      } else {
        await blogApi.likePost(detail.post.id);
        setIsLiked(true);
        setLikeCount((prev) => prev + 1);
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || '좋아요 처리에 실패했습니다. 먼저 로그인해주세요.');
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeletePost = async () => {
    if (!detail) return;
    if (!confirm('정말로 이 글을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) return;

    try {
      await blogApi.deletePost(detail.post.id);
      alert('게시글이 삭제되었습니다.');
      navigate(`/@${cleanUsername}`);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || '삭제 권한이 없거나 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 animate-pulse">
        <div className="h-10 bg-slate-200 rounded w-3/4 mb-4" />
        <div className="h-4 bg-slate-200 rounded w-1/4 mb-10" />
        <div className="h-64 bg-slate-200 rounded-xl mb-6" />
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 rounded w-full" />
          <div className="h-4 bg-slate-200 rounded w-5/6" />
          <div className="h-4 bg-slate-200 rounded w-4/6" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">게시글을 찾을 수 없습니다</h2>
        <p className="text-slate-500 mb-6">존재하지 않거나 비공개 처리된 글입니다.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
        >
          <ArrowLeft className="w-4 h-4" /> 홈으로 이동
        </Link>
      </div>
    );
  }

  const { post, content } = detail;
  const isAuthor = user && user.id === post.userId;

  return (
    <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Floating Side Action Bar (Desktop sticky) */}
      <div className="hidden lg:flex flex-col items-center gap-4 fixed left-[max(1rem,calc(50%-480px))] top-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-full shadow-md z-10">
        <button
          onClick={handleToggleLike}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all ${
            isLiked
              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shadow-inner'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
          title={isLiked ? '좋아요 취소' : '좋아요'}
        >
          <Heart className={`w-5 h-5 ${isLiked ? 'fill-rose-600 dark:fill-rose-400' : ''}`} />
          <span className="text-[11px] font-bold mt-0.5">{likeCount}</span>
        </button>

        <div className="w-6 h-px bg-slate-200 dark:bg-slate-800" />

        <button
          onClick={handleShare}
          className="flex items-center justify-center w-12 h-12 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors relative"
          title="링크 복사"
        >
          <Share2 className="w-5 h-5" />
          {copied && (
            <span className="absolute left-14 bg-slate-900 text-white text-xs px-2.5 py-1 rounded whitespace-nowrap shadow-lg">
              복사 완료!
            </span>
          )}
        </button>
      </div>

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
              {post.publishedAt
                ? new Date(post.publishedAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '임시저장'}
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
                onClick={handleDeletePost}
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

      {/* Thumbnail */}
      {post.thumbnailUrl && (
        <div className="mb-10 rounded-2xl overflow-hidden shadow-sm max-h-96">
          <img src={post.thumbnailUrl} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Main Markdown Body */}
      <article className="pb-12">
        <MarkdownViewer content={content} />
      </article>

      {/* Mobile / Bottom Like & Share */}
      <div className="flex lg:hidden items-center justify-center gap-4 py-6 border-y border-slate-200 dark:border-slate-800 my-8">
        <button
          onClick={handleToggleLike}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
            isLiked
              ? 'bg-rose-500 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-white' : ''}`} />
          <span>좋아요 {likeCount}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-sm transition-all"
        >
          <Share2 className="w-4 h-4" />
          <span>{copied ? '복사됨!' : '공유하기'}</span>
        </button>
      </div>

      {/* Author Bio Card */}
      <div className="flex items-center gap-5 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs mt-12">
        <Link to={`/@${post.username}`} className="flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xl overflow-hidden">
            {post.profileImageUrl ? (
              <img src={post.profileImageUrl} alt={post.nickname} className="w-full h-full object-cover" />
            ) : (
              post.nickname[0]
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/@${post.username}`} className="font-bold text-slate-900 dark:text-slate-100 text-lg hover:underline block">
            {post.nickname}
          </Link>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">@{post.username}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
            지식을 기록하고 나누는 것을 즐기는 DORO 블로거입니다.
          </p>
        </div>
      </div>


      {/* Comments */}
      <CommentSection
        postId={post.id}
        comments={comments}
        onCommentUpdated={() => loadComments(post.id)}
      />
    </div>
  );
};
