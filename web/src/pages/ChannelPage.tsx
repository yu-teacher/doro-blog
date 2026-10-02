import React, { useEffect, useState } from 'react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useParams, useSearchParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { PostSummary } from '../api/types';
import { ChannelProfileHeader } from '../components/channel/ChannelProfileHeader';
import { ChannelTabs, type ChannelTab } from '../components/channel/ChannelTabs';
import { PostsTab } from '../components/channel/PostsTab';
import { SeriesTab } from '../components/channel/SeriesTab';
import { AboutTab } from '../components/channel/AboutTab';
import { LikedPostsTab } from '../components/channel/LikedPostsTab';
import { FollowListModal } from '../components/FollowListModal';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { useAuthStore } from '../store/authStore';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { ErrorState } from '../components/ErrorState';

/** 사용자 채널 경로(/@name)로 해석하면 안 되는 시스템 경로 */
const RESERVED_NAMES = ['logs', 'portal', 'account', 'login', 'signup', 'api', 'media', 'loki'];
const POSTS_PAGE_SIZE = 12;
const LIKED_POSTS_PAGE_SIZE = 30;

export const ChannelPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser, isAuthenticated } = useAuthStore();

  const cleanUsername = username?.startsWith('@') ? username.substring(1) : username || '';
  const currentTab = (searchParams.get('tab') as ChannelTab) || 'posts';
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
  useDocumentMeta({
    title: profile ? `${profile.blogTitle || profile.nickname} (@${profile.username}) - DORO.log` : null,
    description: profile?.bio,
    canonicalPath: profile ? `/@${profile.username}` : null,
  });
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

  const handleTabChange = (newTab: ChannelTab) => {
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
      <ChannelProfileHeader
        cleanUsername={cleanUsername}
        profile={profile}
        isMyChannel={isMyChannel}
        followLoading={followLoading}
        onToggleFollow={handleToggleFollow}
        onOpenFollowList={(tab) => {
          setFollowModalTab(tab);
          setFollowModalOpen(true);
        }}
        onEditProfile={() => setEditModalOpen(true)}
      />

      <ChannelTabs
        currentTab={currentTab}
        isMyChannel={isMyChannel}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onTabChange={handleTabChange}
        onSearchSubmit={handleSearchSubmit}
      />

      {currentTab === 'posts' && (
        <PostsTab
          cleanUsername={cleanUsername}
          posts={posts}
          userTags={userTags}
          totalPostCount={totalPostCount}
          tagFilter={tagFilter}
          keyword={keyword}
          loading={postsLoading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          error={postsError}
          sentinelRef={sentinelRef}
          onTagClick={handleTagClick}
          onClearFilter={handleClearFilter}
          onLoadMore={loadMore}
          onReload={reloadPosts}
        />
      )}

      {currentTab === 'series' && <SeriesTab cleanUsername={cleanUsername} seriesList={seriesList} loading={seriesRes.loading} />}

      {currentTab === 'about' && (
        <AboutTab
          cleanUsername={cleanUsername}
          profile={profile}
          activities={activities}
          isMyChannel={isMyChannel}
          onEditProfile={() => setEditModalOpen(true)}
        />
      )}

      {currentTab === 'likes' && <LikedPostsTab likedPosts={likedPosts} loading={likedRes.loading} />}

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
