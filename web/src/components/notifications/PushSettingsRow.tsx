import React from 'react';
import { BellRing } from 'lucide-react';
import { usePushStore } from '../../store/pushStore';
import type { PushStatus } from '../../store/pushStore';

/** 줄 오른쪽에 보여 줄 현재 상태. null 이면 줄 자체를 숨긴다(서버·브라우저가 푸시를 못 쓰거나 아직 확인 중). */
const STATUS_LABEL: Record<PushStatus, string | null> = {
  loading: null,
  unsupported: null,
  'server-disabled': null,
  'needs-install': '설치 필요',
  denied: '차단됨',
  off: '꺼짐',
  on: '켜짐',
};

/** 알림 드롭다운 하단: 이 기기의 푸시 알림 상태와 설정 열기 버튼. */
export const PushSettingsRow: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const status = usePushStore((state) => state.status);
  const label = STATUS_LABEL[status];
  if (label === null) return null;

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-4 py-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`이 기기 푸시 알림 설정, 현재 ${label}`}
        className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors pointer-coarse:min-h-11"
      >
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <BellRing className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">이 기기 푸시 알림</span>
        </span>
        <span className={status === 'on' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>{label}</span>
      </button>
    </div>
  );
};
