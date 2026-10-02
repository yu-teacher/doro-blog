import React from 'react';
import { ModalShell } from '../ModalShell';
import { Key, Loader2, Plus } from 'lucide-react';

interface CreateKeyModalProps {
  keyName: string;
  setKeyName: (value: string) => void;
  expireDays: number | null;
  setExpireDays: (value: number | null) => void;
  issuing: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

/** 새 API 키 발급 모달 (키 이름과 만료 기간). */
export const CreateKeyModal: React.FC<CreateKeyModalProps> = ({ keyName, setKeyName, expireDays, setExpireDays, issuing, onSubmit, onClose }) => {
  return (
    <ModalShell
      onClose={onClose}
      labelledBy="create-key-title"
      closeOnOverlayClick={false}
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      panelClassName="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95"
    >
        <h3 id="create-key-title" className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <Key className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />새 API 키 발급
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          자동 포스팅에 사용할 키 이름을 지정하고 만료 기간을 선택하세요.
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="create-key-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              키 이름 (용도 구분용)
            </label>
            <input
              id="create-key-name"
              type="text"
              required
              maxLength={50}
              placeholder="예: GitHub Actions 배포, Python 일일 봇"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <span id="create-key-expire" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              만료 기간
            </span>
            <div role="group" aria-labelledby="create-key-expire" className="grid grid-cols-4 gap-2 text-xs">
              {[
                { label: '30일', value: 30 },
                { label: '90일', value: 90 },
                { label: '1년', value: 365 },
                { label: '무기한', value: 0 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={expireDays === opt.value}
                  onClick={() => setExpireDays(opt.value)}
                  className={`py-2 rounded-xl font-medium border transition-all ${
                    expireDays === opt.value
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={issuing || !keyName.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-md"
            >
              {issuing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              발급하기
            </button>
          </div>
        </form>
      </ModalShell>
  
  );
};
