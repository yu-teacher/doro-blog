import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/** 목록/상세 불러오기에 실패했을 때, 빈 화면 대신 원인과 다시 시도 버튼을 보여준다. */
export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => (
  <div
    role="alert"
    className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-red-100 dark:border-red-900/40"
  >
    <AlertCircle className="w-8 h-8 mx-auto mb-3 text-red-500" aria-hidden="true" />
    <p className="text-slate-700 dark:text-slate-200 font-medium">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        다시 시도
      </button>
    )}
  </div>
);

interface LoadMoreErrorProps {
  message: string;
  onRetry: () => void;
}

/** 다음 페이지만 실패했을 때 목록 아래에 보여주는 한 줄 오류와 다시 시도 버튼. */
export const LoadMoreError: React.FC<LoadMoreErrorProps> = ({ message, onRetry }) => (
  <div role="alert" className="flex items-center justify-center gap-3 py-6 text-sm text-slate-500 dark:text-slate-400">
    <span>{message}</span>
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-700 dark:text-slate-200 font-semibold transition-colors"
    >
      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
      다시 시도
    </button>
  </div>
);
