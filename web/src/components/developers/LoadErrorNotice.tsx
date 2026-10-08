import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface LoadErrorNoticeProps {
  /** 무엇을 불러오지 못했는지, 예: "API 키 목록" */
  subject: string;
  message: string;
  onRetry: () => void;
  /** 이미 받아 둔 데이터 위에 한 줄로 얹을 때 true */
  compact?: boolean;
}

/** 목록 조회에 실패했음을 알리고 다시 시도하게 한다. 빈 목록 안내와 구분되도록 경고 색을 쓴다. */
export const LoadErrorNotice: React.FC<LoadErrorNoticeProps> = ({ subject, message, onRetry, compact = false }) => (
  <div
    role="alert"
    className={`flex items-center justify-between gap-3 rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 ${
      compact ? 'px-4 py-2.5 text-xs mb-3' : 'flex-col sm:flex-row px-6 py-8 text-sm'
    }`}
  >
    <span className="flex items-center gap-2 font-medium">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      {subject}을(를) 불러오지 못했습니다. 저장된 데이터는 그대로입니다. ({message})
    </span>
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
    >
      <RefreshCw className="w-3.5 h-3.5" />다시 시도
    </button>
  </div>
);
