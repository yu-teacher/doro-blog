import React from 'react';
import { Heart, Share2 } from 'lucide-react';

interface MobilePostActionsProps {
  isLiked: boolean;
  likeCount: number;
  copied: boolean;
  onToggleLike: () => void;
  onShare: () => void;
}

/** 모바일/태블릿에서 본문 아래에 보이는 좋아요/공유 버튼. */
export const MobilePostActions: React.FC<MobilePostActionsProps> = ({ isLiked, likeCount, copied, onToggleLike, onShare }) => (
  <>
    {/* Mobile / Tablet Bottom Like & Share */}
    <div className="flex xl:hidden items-center justify-center gap-4 py-6 border-y border-slate-200 dark:border-slate-800 my-8">
      <button
        onClick={onToggleLike}
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
        onClick={onShare}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-sm transition-all"
      >
        <Share2 className="w-4 h-4" />
        <span>{copied ? '복사됨!' : '공유하기'}</span>
      </button>
    </div>
  </>
);
