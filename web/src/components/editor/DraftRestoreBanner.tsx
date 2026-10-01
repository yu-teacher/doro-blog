import React from 'react';
import { Sparkles } from 'lucide-react';

interface DraftRestoreBannerProps {
  onRestore: () => void;
  onDiscard: () => void;
}

/** 이전에 로컬에 백업된 작성 중인 글이 있을 때 이어서 쓸지 묻는 배너. */
export const DraftRestoreBanner: React.FC<DraftRestoreBannerProps> = ({ onRestore, onDiscard }) => (
    <div className="bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 px-6 py-3 flex items-center justify-between text-xs animate-in slide-in-from-top-2">
      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
        <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>이전에 작성 중이던 <strong>임시 저장본</strong>이 있습니다. 이어서 작성하시겠습니까?</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRestore}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition-colors"
        >
          불러오기
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="px-2.5 py-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          삭제
        </button>
      </div>
    </div>
  
);
