import React from 'react';
import type { UserActivity, UserProfile } from '../../api/types';
import { ActivityHeatmap } from '../ActivityHeatmap';
import { MarkdownViewer } from '../MarkdownViewer';
import { Edit3 } from 'lucide-react';

interface AboutTabProps {
  cleanUsername: string;
  profile: UserProfile | null;
  activities: UserActivity[];
  isMyChannel: boolean;
  onEditProfile: () => void;
}

/** 소개(마크다운)와 활동 히트맵 탭. */
export const AboutTab: React.FC<AboutTabProps> = ({ cleanUsername, profile, activities, isMyChannel, onEditProfile }) => (
  <>
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
                onClick={() => onEditProfile()}
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
      
  </>
);
