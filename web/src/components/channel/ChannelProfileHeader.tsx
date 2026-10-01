import React from 'react';
import type { UserProfile } from '../../api/types';
import { safeHttpUrl } from '../../utils/safeUrl';
import { Globe, Loader2, Mail, Settings, User, UserCheck, UserMinus, UserPlus } from 'lucide-react';

interface ChannelProfileHeaderProps {
  cleanUsername: string;
  profile: UserProfile | null;
  isMyChannel: boolean;
  followLoading: boolean;
  onToggleFollow: () => void;
  onOpenFollowList: (tab: 'followers' | 'following') => void;
  onEditProfile: () => void;
}

/** 채널 상단 프로필: 아바타, 이름, 소개, 팔로우/프로필 수정 버튼, 팔로워 수, 소셜 링크. */
export const ChannelProfileHeader: React.FC<ChannelProfileHeaderProps> = ({ cleanUsername, profile, isMyChannel, followLoading, onToggleFollow, onOpenFollowList, onEditProfile }) => (
  <>
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
                onClick={() => onEditProfile()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>프로필 수정</span>
              </button>
            ) : (
              <button
                disabled={followLoading}
                onClick={onToggleFollow}
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
              onOpenFollowList('followers');
            }}
            className="hover:underline hover:text-emerald-600 dark:hover:text-emerald-400 font-medium"
          >
            팔로워 <strong className="text-slate-900 dark:text-slate-100 font-bold">{profile?.followerCount ?? 0}</strong>명
          </button>
          <span>·</span>
          <button
            onClick={() => {
              onOpenFollowList('following');
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
  </>
);
