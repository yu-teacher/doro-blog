import React from 'react';
import type { CreateApiKeyResponse } from '../../api/types';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { Check, Copy, Key } from 'lucide-react';

interface NewKeyAlertProps {
  createdKey: CreateApiKeyResponse;
  onDismiss: () => void;
}

/** 방금 발급된 API 키를 한 번만 보여주는 알림. 서버에는 해시만 남으므로 이 화면에서 복사해야 한다. */
export const NewKeyAlert: React.FC<NewKeyAlertProps> = ({ createdKey, onDismiss }) => {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="rounded-2xl border-2 border-emerald-500/80 bg-emerald-50 dark:bg-emerald-950/40 p-6 shadow-xl animate-in fade-in slide-in-from-top-4">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-md">
          <Key className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-emerald-950 dark:text-emerald-200">
              새 API 키가 성공적으로 발급되었습니다!
            </h3>
            <button
              onClick={() => onDismiss()}
              className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-white text-sm font-semibold"
            >
              닫기
            </button>
          </div>
          <p className="text-sm text-emerald-800 dark:text-emerald-300/90 mb-4">
            이 키는 사용자의 보안을 위해 <span className="font-bold underline">지금 단 한 번만 표시</span>되며,
            서버에는 SHA-256 해시로만 안전하게 보관됩니다. 지금 복사하여 환경 변수나 안전한 시크릿에 저장하세요.
          </p>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3">
            <code className="flex-1 font-mono text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 select-all break-all">
              {createdKey.apiKey}
            </code>
            <button
              onClick={() => copy(createdKey.apiKey)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm flex-shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? '복사됨!' : '키 복사'}
            </button>
          </div>
        </div>
      </div>
    </div>
  
  );
};
