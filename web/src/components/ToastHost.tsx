import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import type { Toast } from '../store/toastStore';

/** 알림이 저절로 사라지기까지의 시간(ms). 오류는 읽을 시간이 더 필요하다. */
export const TOAST_DURATION_MS = { info: 4000, error: 7000 } as const;

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), TOAST_DURATION_MS[toast.kind]);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.kind, dismiss]);

  const isError = toast.kind === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm bg-white dark:bg-slate-900 ${
        isError ? 'border-red-200 dark:border-red-900/50' : 'border-emerald-200 dark:border-emerald-900/50'
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${isError ? 'text-red-500' : 'text-emerald-500'}`} aria-hidden="true" />
      <p className="flex-1 text-slate-700 dark:text-slate-200 break-words">{toast.message}</p>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="알림 닫기"
        className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
};

/** 앱 맨 위에 한 번만 둔다. 쌓인 알림을 화면 아래쪽에 보여 준다. */
export const ToastHost: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) {
    return null;
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
      <div className="flex w-full max-w-md flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </div>
  );
};
