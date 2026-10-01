import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { PostSummary } from '../api/types';
import { PostCard } from '../components/PostCard';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { FollowListModal } from '../components/FollowListModal';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { useAuthStore } from '../store/authStore';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { ErrorState, LoadMoreError } from '../components/ErrorState';
import { safeHttpUrl } from '../utils/safeUrl';
import {
  FileText,
  BookOpen,
  Search,
  Globe,
  User,
  Loader2,
  Mail,
  UserPlus,
  UserCheck,
  UserMinus,
  Settings,
  Edit3,
  Tag,
  Sparkles,
  Bookmark,
  Heart,
} from 'lucide-react';
import { formatDate } from '../utils/date';

/** 사용자 채널 경로(/@name)로 해석하면 안 되는 시스템 경로 */
const RESERVED_NAMES = ['logs', 'portal', 'account', 'login', 'signup', 'api', 'media', 'loki'];
const POSTS_PAGE_SIZE = 12;
const LIKED_POSTS_PAGE_SIZE = 30;

export const ChannelPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser, isAuthenticated } = useAuthStore();

  const cleanUsername = username?.startsWith('@') ? username.substring(1) : username || '';
  const currentTab = (searchParams.get('tab') as 'posts' | 'series' | 'about' | 'likes') || 'posts';
  const tagFilter = searchParams.get('tag') || '';
  const keyword = searchParams.get('q') || '';

  // 시스템 예약 경로(logs, portal 등)가 게시판 유저 라우트에 매칭되었을 경우 처리
  useEffect(() => {
    const lower = cleanUsername.toLowerCase();
    const reservedRedirects: Record<string, string> = {
      logs: '/logs',
      portal: '/portal',
      account: '/portal/account',
      login: '/portal/login',
      signup: '/portal/signup',
    };
    if (reservedRedirects[lower]) {
      window.location.replace(reservedRedirects[lower]);
    }
  }, [cleanUsername]);

  const [searchInput, setSearchInput] = useState(keyword);
  const [followLoading, setFollowLoading] = useState(false);

  // Modals
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers');
  const [editModalOpen, setEditModalOpen] = useState(false);

  const isMyChannel = isAuthenticated && currentUser?.username === cleanUsername;

  const isReserved = RESERVED_NAMES.includes(cleanUsername.toLowerCase());
  const channelReady = Boolean(cleanUsername) && !isReserved;

  // 채널이 바뀌거나 탭/필터를 빠르게 바꿔도 이전 요청은 취소되고 늦게 온 응답은 버려진다
  const profileRes = useAsyncResource((signal) => blogApi.getUserProfile(cleanUsername, signal), [cleanUsername], { enabled: channelReady });
  const tagsRes = useAsyncResource((signal) => blogApi.getUserTags(cleanUsername, signal), [cleanUsername], { enabled: channelReady });
  const activityRes = useAsyncResource((signal) => blogApi.getUserActivity(cleanUsername, signal), [cleanUsername], { enabled: channelReady });
  const seriesRes = useAsyncResource((signal) => blogApi.getUserSeries(cleanUsername, signal), [cleanUsername], {
    enabled: channelReady && currentTab === 'series',
  });
  const likedRes = useAsyncResource((signal) => blogApi.getMyLikedPosts(0, LIKED_POSTS_PAGE_SIZE, signal), [cleanUsername], {
    enabled: channelReady && currentTab === 'likes',
  });
  const postList = usePaginatedList<PostSummary>(
    (page, signal) => blogApi.getUserPosts(cleanUsername, keyword || undefined, tagFilter || undefined, page, POSTS_PAGE_SIZE, signal),
    [cleanUsername, tagFilter, keyword],
    { enabled: channelReady && currentTab === 'posts' }
  );

  const profile = profileRes.data;
  const setProfile = profileRes.setData;
  const userTags = tagsRes.data ?? [];
  const activities = activityRes.data ?? [];
  const seriesList = seriesRes.data ?? [];
  const likedPosts = likedRes.data?.content ?? [];
  const { items: posts, hasMore, loading: postsLoading, loadingMore, error: postsError, loadMore, reload: reloadPosts } = postList;

  // 팔로우 목록 모달에서 팔로우 수가 바뀌면 화면을 비우지 않고 프로필만 조용히 갱신한다
  const refreshProfile = async () => {
    try {
      setProfile(await blogApi.getUserProfile(cleanUsername));
    } catch (err: unknown) {
      console.error('Failed to refresh profile', err);
    }
  };

  const sentinelRef = useInfiniteScroll({
    onIntersect: loadMore,
    enabled: currentTab === 'posts' && hasMore && !postsLoading && !loadingMore && !postsError,
  });

  const handleToggleFollow = async () => {
    if (!isAuthenticated) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!profile) return;
    setFollowLoading(true);
    try {
      if (profile.isFollowing) {
        const updated = await blogApi.unfollowUser(cleanUsername);
        setProfile({ ...profile, isFollowing: false, followerCount: updated.followerCount });
      } else {
        const updated = await blogApi.followUser(cleanUsername);
        setProfile({ ...profile, isFollowing: true, followerCount: updated.followerCount });
      }
    } catch (err) {
      console.error('Failed to toggle follow', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleTabChange = (newTab: 'posts' | 'series' | 'about' | 'likes') => {
    const p = new URLSearchParams(searchParams);
    p.set('tab', newTab);
    setSearchParams(p);
  };

  const handleTagClick = (tag: string) => {
    const p = new URLSearchParams(searchParams);
    if (tag) {
      p.set('tag', tag);
    } else {
      p.delete('tag');
    }
    p.delete('q');
    setSearchInput('');
    setSearchParams(p);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      p.set('q', searchInput.trim());
    } else {
      p.delete('q');
    }
    setSearchParams(p);
  };

  const handleClearFilter = () => {
    setSearchInput('');
    const p = new URLSearchParams();
    p.set('tab', 'posts');
    setSearchParams(p);
  };

  // 존재하지 않는 채널이거나 프로필을 불러오지 못한 경우: 빈 화면 대신 원인과 다시 시도를 보여준다
  if (profileRes.error && !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <ErrorState message={profileRes.error} onRetry={profileRes.reload} />
      </div>
    );
  }

  const totalPostCount = userTags.reduce((sum, t) => sum + t.postCount, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Author Profile Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-10 border-b border-slate-200 dark:border-slate-800">
        <div className="w-28 h-28 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-3xl overflow-hidden shadow-sm flex-shrink-0 border border-emerald-200 dark:border-emerald-800">
          {profile?.profileImageUrl ? (
            <img src={profile.profileImageUrl} alt={profile.nickname} className="w-full h-full object-cover" />
          ) : (
            profile?.nickname ? profile.nickname[0] : <User className="w-12 h-12" />
          )}
        </div>

        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  {profile?.nickname || cleanUsername}
                </h1>
                <span className="text-sm font-mono text-slate-400 dark:text-slate-500">@{cleanUsername}</span>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                {profile?.blogTitle}
              </p>
            </div>

            {/* Action Buttons: Follow or Edit Profile */}
            <div className="flex items-center justify-center gap-2">
              {isMyChannel ? (
                <button
                  onClick={() => setEditModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>프로필 수정</span>
                </button>
              ) : (
                <button
                  disabled={followLoading}
                  onClick={handleToggleFollow}
                  className={`group inline-flex items-center justify-center min-w-[84px] gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer ${
                    profile?.isFollowing
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-900'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {followLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : profile?.isFollowing ? (
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
          </div>

          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base mt-3 max-w-2xl leading-relaxed">
            {profile?.bio || '아직 소개글이 작성되지 않았습니다.'}
          </p>

          {/* Followers & Following Counts (Clickable to open modal) */}
          <div className="flex items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
            <button
              onClick={() => {
                setFollowModalTab('followers');
                setFollowModalOpen(true);
              }}
              className="hover:underline hover:text-emerald-600 dark:hover:text-emerald-400 font-medium"
            >
              팔로워 <strong className="text-slate-900 dark:text-slate-100 font-bold">{profile?.followerCount ?? 0}</strong>명
            </button>
            <span>·</span>
            <button
              onClick={() => {
                setFollowModalTab('following');
                setFollowModalOpen(true);
              }}
              className="hover:underline hover:text-emerald-600 dark:hover:text-emerald-400 font-medium"
            >
              팔로잉 <strong className="text-slate-900 dark:text-slate-100 font-bold">{profile?.followingCount ?? 0}</strong>명
            </button>
          </div>

          {/* Social Links Row */}
          <div className="flex items-center justify-center sm:justify-start gap-3 mt-4 text-slate-400 dark:text-slate-500">
            {safeHttpUrl(profile?.githubUrl) && (
              <a
                href={safeHttpUrl(profile?.githubUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                title="GitHub"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
            )}
            {safeHttpUrl(profile?.websiteUrl) && (
              <a
                href={safeHttpUrl(profile?.websiteUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="개인 홈페이지"
              >
                <Globe className="w-4 h-4" />
              </a>
            )}
            {profile?.publicEmail && (
              <a
                href={`mailto:${profile.publicEmail}`}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title={`이메일 보내기 (${profile.publicEmail})`}
              >
                <Mail className="w-4 h-4" />
              </a>
            )}
            {safeHttpUrl(profile?.linkedinUrl) && (
              <a
                href={safeHttpUrl(profile?.linkedinUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 transition-colors"
                title="LinkedIn"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            )}
            {safeHttpUrl(profile?.twitterUrl) && (
              <a
                href={safeHttpUrl(profile?.twitterUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-500 transition-colors"
                title="Twitter / X"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 3 Main Tabs: 글 / 시리즈 / 소개 */}
      <div className="flex items-center justify-between mt-8 mb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-8">
          <button
            onClick={() => handleTabChange('posts')}
            className={`flex items-center gap-2 pb-3 text-lg font-bold transition-all relative ${
              currentTab === 'posts'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>글</span>
          </button>

          <button
            onClick={() => handleTabChange('series')}
            className={`flex items-center gap-2 pb-3 text-lg font-bold transition-all relative ${
              currentTab === 'series'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span>시리즈</span>
          </button>

          <button
            onClick={() => handleTabChange('about')}
            className={`flex items-center gap-2 pb-3 text-lg font-bold transition-all relative ${
              currentTab === 'about'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>소개</span>
          </button>

          {isMyChannel && (
            <button
              onClick={() => handleTabChange('likes')}
              className={`flex items-center gap-2 pb-3 text-lg font-bold transition-all relative ${
                currentTab === 'likes'
                  ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Bookmark className="w-5 h-5" />
              <span>관심 글</span>
            </button>
          )}
        </div>

        {/* In-channel search input (when on Posts tab) */}
        {currentTab === 'posts' && (
          <form onSubmit={handleSearchSubmit} className="relative w-44 sm:w-60 pb-2">
            <input
              type="text"
              placeholder="블로그 내 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-full text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 border border-transparent focus:border-emerald-500 transition-all"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
          </form>
        )}
      </div>

      {/* Tab 1: Posts with Outer Left Tag Sidebar */}
      {currentTab === 'posts' && (
        <div className="relative">
          {/* Outer Left Fixed Tag Sidebar (Desktop: >= 1280px / xl) */}
          {userTags.length > 0 && (
            <aside className="hidden xl:block absolute right-full mr-8 2xl:mr-12 top-0 h-full w-48 select-none">
              <div className="sticky top-28 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800">
                  <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>태그 목록</span>
                </div>

                <div className="flex flex-col gap-1 max-h-[calc(100vh-160px)] overflow-y-auto text-xs pr-1">
                  <button
                    onClick={() => handleTagClick('')}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium transition-colors ${
                      !tagFilter
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>전체보기</span>
                    <span className="text-[11px] opacity-70 ml-2">({totalPostCount})</span>
                  </button>

                  {userTags.map((t) => {
                    const isSelected = tagFilter === t.name;
                    return (
                      <button
                        key={t.name}
                        onClick={() => handleTagClick(t.name)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium transition-colors ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">#{t.name}</span>
                        <span className="text-[11px] opacity-70 ml-2">({t.postCount})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          )}

          {/* Active Search/Filter Indicator */}
          {(keyword || tagFilter) && (
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-4 py-2 rounded-lg text-sm mb-6 border border-emerald-100 dark:border-emerald-800">
              <span>
                {keyword && <>검색어 <strong>"{keyword}"</strong> </>}
                {tagFilter && <>태그 <strong>#{tagFilter}</strong> </>}
                결과
              </span>
              <button onClick={handleClearFilter} className="text-xs text-emerald-700 dark:text-emerald-400 underline font-semibold">
                필터 초기화
              </button>
            </div>
          )}

          {/* Mobile / Tablet Horizontal Tag Chip Bar (< xl) */}
          {userTags.length > 0 && (
            <div className="xl:hidden mb-6 flex items-center gap-1.5 overflow-x-auto pb-2 text-xs">
              <button
                onClick={() => handleTagClick('')}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-colors ${
                  !tagFilter
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                전체보기 ({totalPostCount})
              </button>
              {userTags.map((t) => (
                <button
                  key={t.name}
                  onClick={() => handleTagClick(t.name)}
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-colors ${
                    tagFilter === t.name
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  #{t.name} ({t.postCount})
                </button>
              ))}
            </div>
          )}

          {/* Main Posts Grid (Full Width) */}
          <main className="w-full">
            {postsLoading ? (
              <div className="space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-40 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-6" />
                ))}
              </div>
            ) : postsError && posts.length === 0 ? (
              <ErrorState message={postsError} onRetry={reloadPosts} />
            ) : posts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} channelUsername={cleanUsername} />
                  ))}
                </div>

                {/* Infinite Scroll Sentinel */}
                <div ref={sentinelRef} className="py-8 flex flex-col items-center justify-center">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <span>글을 더 불러오는 중...</span>
                    </div>
                  )}
                  {postsError && <LoadMoreError message={postsError} onRetry={loadMore} />}
                  {!hasMore && posts.length > 0 && (
                    <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-600">
                      <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        모든 글을 불러왔습니다
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-slate-400 dark:text-slate-500">작성된 글이 없습니다.</p>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Tab 2: Series */}
      {currentTab === 'series' && (
        <div>
          {seriesRes.loading ? (
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
      )}

      {/* Tab 3: About & Activity Heatmap */}
      {currentTab === 'about' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Activity Heatmap Lawn */}
          <ActivityHeatmap
            activities={activities}
            authorNickname={profile?.nickname || cleanUsername}
          />

          {/* Detailed About Markdown */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
            {profile?.aboutMarkdown ? (
              <article>
                <MarkdownViewer content={profile.aboutMarkdown} />
              </article>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">
                  아직 상세 소개글이 등록되지 않았습니다.
                </p>
                {isMyChannel && (
                  <button
                    onClick={() => setEditModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>소개글 작성하기</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Liked / Saved Posts (Personal Interest Archive) */}
      {currentTab === 'likes' && (
        <div className="animate-in fade-in duration-200">
          {likedRes.loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6" />
              ))}
            </div>
          ) : likedPosts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {likedPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
              <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">아직 좋아요를 누른 관심 글이 없습니다.</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                피드에서 마음에 드는 기술 글에 좋아요(하트)를 누르면 이곳에 보관됩니다.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Follow List Modal */}
      <FollowListModal
        username={cleanUsername}
        initialTab={followModalTab}
        isOpen={followModalOpen}
        onClose={() => setFollowModalOpen(false)}
        onFollowCountChanged={refreshProfile}
      />

      {/* Profile Edit Modal */}
      {profile && (
        <ProfileEditModal
          profile={profile}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onUpdated={(updated) => {
            setProfile(updated);
            tagsRes.reload();
          }}
        />
      )}
    </div>
  );
};
