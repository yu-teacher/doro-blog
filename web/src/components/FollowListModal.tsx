import React, { useEffect, useState } from 'react';
import { ModalShell } from './ModalShell';
import { Link } from 'react-router-dom';
import { blogApi } from '../api/blogApi';
import type { FollowUser } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { X, UserPlus, UserCheck, UserMinus, Loader2, User } from 'lucide-react';

const FOLLOW_LIST_SIZE = 50;

interface FollowListModalProps {
  username: string;
  initialTab: 'followers' | 'following';
  isOpen: boolean;
  onClose: () => void;
  onFollowCountChanged?: () => void;
}

export const FollowListModal: React.FC<FollowListModalProps> = ({
  username,
  initialTab,
  isOpen,
  onClose,
  onFollowCountChanged,
}) => {
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const [tab, setTab] = useState<'followers' | 'following'>(initialTab);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // 열려 있는 동안 탭/사용자가 바뀌면 이전 요청을 취소하고 새로 불러온다
  const list = useAsyncResource(
    (signal) =>
      tab === 'followers'
        ? blogApi.getFollowers(username, 0, FOLLOW_LIST_SIZE, signal)
        : blogApi.getFollowing(username, 0, FOLLOW_LIST_SIZE, signal),
    [tab, username],
    { enabled: isOpen }
  );
  const users: FollowUser[] = list.data?.content ?? [];
  const loading = list.loading;

  const updateUser = (id: string, patch: Partial<FollowUser>) =>
    list.setData((prev) => (prev ? { ...prev, content: prev.content.map((u) => (u.id === id ? { ...u, ...patch } : u)) } : prev));

  const handleToggleFollow = async (targetUser: FollowUser) => {
    if (!isAuthenticated) {
      alert('로그인이 필요합니다.');
      return;
    }
    setActionLoadingId(targetUser.id);
    try {
      if (targetUser.isFollowing) {
        await blogApi.unfollowUser(targetUser.username);
        updateUser(targetUser.id, { isFollowing: false });
      } else {
        await blogApi.followUser(targetUser.username);
        updateUser(targetUser.id, { isFollowing: true });
      }
      onFollowCountChanged?.();
    } catch (err) {
      console.error('Failed to toggle follow in modal', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShell onClose={onClose} ariaLabel="팔로워 및 팔로잉 목록" overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 cursor-pointer" panelClassName="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh] cursor-default">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setTab('followers')}
              className={`text-base font-bold pb-2 transition-all relative ${
                tab === 'followers'
                  ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              팔로워
            </button>
            <button
              onClick={() => setTab('following')}
              className={`text-base font-bold pb-2 transition-all relative ${
                tab === 'following'
                  ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              팔로잉
            </button>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span>불러오는 중...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
              {tab === 'followers' ? '아직 팔로워가 없습니다.' : '아직 팔로우한 사람이 없습니다.'}
            </div>
          ) : (
            users.map((item) => {
              const isMe = currentUser?.id === item.id;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <Link
                    to={`/@${item.username}`}
                    onClick={onClose}
                    className="flex items-center gap-3 flex-1 min-w-0 group"
                  >
                    <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-sm overflow-hidden flex-shrink-0 border border-emerald-200 dark:border-emerald-800">
                      {item.profileImageUrl ? (
                        <img src={item.profileImageUrl} alt={item.nickname} className="w-full h-full object-cover" />
                      ) : (
                        item.nickname ? item.nickname[0] : <User className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                        {item.nickname}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                        @{item.username}
                      </div>
                      {item.bio && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {item.bio}
                        </div>
                      )}
                    </div>
                  </Link>

                  {!isMe && isAuthenticated && (
                    <button
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleToggleFollow(item)}
                      className={`group inline-flex items-center justify-center min-w-[76px] gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs flex-shrink-0 cursor-pointer ${
                        item.isFollowing
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-900'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {actionLoadingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : item.isFollowing ? (
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
              );
            })
          )}
        </div>
      </ModalShell>
  );
};
