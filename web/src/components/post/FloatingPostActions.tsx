import React from 'react';
import { Heart, Share2 } from 'lucide-react';

interface FloatingPostActionsProps {
  isLiked: boolean;
  likeCount: number;
  copied: boolean;
  onToggleLike: () => void;
  onShare: () => void;
}

/** 데스크톱에서 본문 옆에 떠 있는 좋아요/공유 버튼. */
export const FloatingPostActions: React.FC<FloatingPostActionsProps> = ({ isLiked, likeCount, copied, onToggleLike, onShare }) => (
  <>
    {/* Floating Side Action Bar (Desktop sticky) */}
    <div className="hidden xl:block absolute right-full top-36 mr-6 2xl:mr-10 h-full">
      <div className="sticky top-36 flex flex-col items-center gap-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-full shadow-md z-10">
        <button
          onClick={onToggleLike}
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
          onClick={onShare}
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
    </div>
  </>
);
