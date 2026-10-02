import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import { useAuthStore } from '../store/authStore';
import { trackEvent } from '../utils/analytics';
import type { PostDetail, Comment, SeriesDetail, PostSummary } from '../api/types';
import { FloatingPostActions } from '../components/post/FloatingPostActions';
import { MobilePostActions } from '../components/post/MobilePostActions';
import { PostHeader } from '../components/post/PostHeader';
import { SeriesInfoBox } from '../components/post/SeriesInfoBox';
import { AuthorCard } from '../components/post/AuthorCard';
import { RelatedPosts } from '../components/post/RelatedPosts';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { CommentSection } from '../components/CommentSection';
import {
  ArrowLeft,
} from 'lucide-react';
import { getErrorMessage, isCancelled } from '../utils/errors';
import { ErrorState } from '../components/ErrorState';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { stripMarkdown } from '../utils/markdown';

const SITE_NAME = 'DORO.log';

const RELATED_POSTS_LIMIT = 4;

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
  const { copied, copy: copyToClipboard } = useCopyToClipboard();
  const [authorFollowing, setAuthorFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState<PostSummary[]>([]);

  // Clean username if prefixed with @
  const cleanUsername = username?.startsWith('@') ? username.substring(1) : username;
    const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useDocumentMeta({
    title: detail?.post.title ? `${detail.post.title} - ${SITE_NAME}` : null,
    canonicalPath: detail ? `/@${detail.post.username}/${detail.post.slug}` : null,
    description: detail ? detail.post.summary || stripMarkdown(detail.content) : null,
  });

  // 글이 바뀌거나 페이지를 떠나면 진행 중인 요청을 취소하고, 늦게 도착한 이전 글의 응답은 버린다
  useEffect(() => {
    if (!cleanUsername || !slug) return;
    const controller = new AbortController();
    const { signal } = controller;

    setLoading(true);
    setLoadError(null);
    setDetail(null);
    setComments([]);
    setSeriesDetail(null);
    setRelatedPosts([]);

    const load = async () => {
      try {
        const postData = await blogApi.getPostBySlug(cleanUsername, slug, signal);
        if (signal.aborted) return;
        setDetail(postData);
        setLikeCount(postData.post.likeCount);
        setIsLiked(postData.likedByMe);
        setAuthorFollowing(postData.author?.isFollowing ?? false);

        trackEvent('post_view', {
          post_id: postData.post.id,
          post_title: postData.post.title,
          author: cleanUsername,
        });

        // 본문 이후의 부가 정보(댓글/시리즈/추천)는 서로 독립적이므로 병렬로 불러오고, 실패해도 글은 보여준다
        const [commentsRes, seriesRes, relatedRes] = await Promise.allSettled([
          blogApi.getComments(postData.post.id, signal),
          postData.post.seriesId ? blogApi.getSeries(postData.post.seriesId, signal) : Promise.resolve(null),
          blogApi.getRelatedPosts(cleanUsername, slug, RELATED_POSTS_LIMIT, signal),
        ]);
        if (signal.aborted) return;
        if (commentsRes.status === 'fulfilled') setComments(commentsRes.value || []);
        else console.error('Failed to load comments', commentsRes.reason);
        if (seriesRes.status === 'fulfilled') setSeriesDetail(seriesRes.value);
        else console.error('Failed to load series', seriesRes.reason);
        if (relatedRes.status === 'fulfilled') setRelatedPosts(relatedRes.value || []);
        else console.error('Failed to load related posts', relatedRes.reason);
      } catch (err: unknown) {
        if (signal.aborted || isCancelled(err)) return;
        setLoadError(getErrorMessage(err, '게시글을 불러올 수 없습니다.'));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };
    void load();

    return () => controller.abort();
  }, [cleanUsername, slug, reloadKey]);

  const handleToggleAuthorFollow = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!detail?.post) return;
    setFollowLoading(true);
    try {
      if (authorFollowing) {
        await blogApi.unfollowUser(detail.post.username);
        setAuthorFollowing(false);
      } else {
        await blogApi.followUser(detail.post.username);
        setAuthorFollowing(true);
      }
    } catch (err) {
      console.error('Failed to toggle author follow', err);
    } finally {
      setFollowLoading(false);
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
        trackEvent('post_like', {
          post_id: detail.post.id,
          post_title: detail.post.title,
          author: cleanUsername,
        });
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, '좋아요 처리에 실패했습니다. 먼저 로그인해주세요.'));
    }
  };

  const handleShare = async () => {
    // 복사에 실패하면(권한 거부 등) 공유 이벤트로 집계하지 않는다
    if (!(await copyToClipboard(window.location.href))) return;
    trackEvent('post_share', {
      post_id: detail?.post.id,
      post_title: detail?.post.title,
    });
  };

  const handleDeletePost = async () => {
    if (!detail) return;
    if (!confirm('정말로 이 글을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) return;

    try {
      await blogApi.deletePost(detail.post.id);
      alert('게시글이 삭제되었습니다.');
      navigate(`/@${cleanUsername}`);
    } catch (err: unknown) {
      alert(getErrorMessage(err, '삭제 권한이 없거나 실패했습니다.'));
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

  if (!detail && loadError) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <ErrorState message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
        <div className="text-center mt-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600">
            <ArrowLeft className="w-4 h-4" /> 홈으로 이동
          </Link>
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
  const isThumbnailInContent = Boolean(
    post.thumbnailUrl &&
      (content.includes(post.thumbnailUrl) ||
        content.includes(post.thumbnailUrl.replace(/^https?:\/\/[^/]+/, '')))
  );

  return (
    <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <FloatingPostActions isLiked={isLiked} likeCount={likeCount} copied={copied} onToggleLike={handleToggleLike} onShare={handleShare} />

      <PostHeader post={post} isAuthor={Boolean(isAuthor)} onDelete={handleDeletePost} />

      <SeriesInfoBox post={post} seriesDetail={seriesDetail} />

      {/* Thumbnail (Only show if not already present in article body) */}
      {post.thumbnailUrl && !isThumbnailInContent && (
        <div className="mb-10 rounded-2xl overflow-hidden shadow-sm max-h-96">
          <img src={post.thumbnailUrl} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Main Markdown Body */}
      <article className="pb-12">
        <MarkdownViewer content={content} />
      </article>

      <MobilePostActions isLiked={isLiked} likeCount={likeCount} copied={copied} onToggleLike={handleToggleLike} onShare={handleShare} />

      <AuthorCard
        post={post}
        author={detail.author}
        isAuthor={Boolean(isAuthor)}
        authorFollowing={authorFollowing}
        followLoading={followLoading}
        onToggleFollow={handleToggleAuthorFollow}
      />

      <RelatedPosts relatedPosts={relatedPosts} />

      {/* Comments */}
      <CommentSection
        postId={post.id}
        comments={comments}
        onCommentUpdated={() => loadComments(post.id)}
      />
    </div>
  );
};
