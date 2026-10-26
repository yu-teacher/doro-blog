import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { PushPreferences } from '../../api/pushApi';
import { usePushStore } from '../../store/pushStore';
import type { PushStatus } from '../../store/pushStore';
import { ModalShell } from '../ModalShell';

export const PREFERENCE_LABELS: ReadonlyArray<{ key: keyof PushPreferences; label: string; hint: string }> = [
  { key: 'comments', label: '댓글', hint: '내 글에 새 댓글이 달렸을 때' },
  { key: 'replies', label: '답글', hint: '내 댓글에 답글이 달렸을 때' },
  { key: 'likes', label: '좋아요', hint: '내 글에 좋아요가 눌렸을 때' },
  { key: 'follows', label: '새 팔로워', hint: '누군가 나를 팔로우했을 때' },
];

/** 켤 수 없는 상태별 설명(이유와 해결 방법). */
const STATUS_TEXT: Record<Exclude<PushStatus, 'on' | 'off' | 'loading'>, string> = {
  unsupported: '이 브라우저는 푸시 알림을 지원하지 않아요. 최신 크롬·사파리·엣지에서 열어 주세요.',
  'needs-install': '아이폰·아이패드에서는 사파리의 공유 버튼 → "홈 화면에 추가"로 앱을 설치한 뒤, 설치한 앱에서 알림을 켤 수 있어요.',
  'server-disabled': '이 서버에서는 푸시 알림을 쓸 수 없어요.',
  denied: '이 기기에서 알림이 막혀 있어요. 브라우저(또는 기기) 설정에서 이 사이트의 알림을 허용한 뒤 다시 열어 주세요.',
};

const BUTTON = 'rounded-lg px-3 py-2.5 text-sm font-semibold disabled:opacity-60 pointer-coarse:min-h-11';

/** 이 기기로 푸시 알림을 받을지, 어떤 알림을 받을지 정하는 대화상자. */
const PushSettingsDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { status, preferences, busy, error } = usePushStore();
  const { refresh, enable, disable, setPreference, sendTest } = usePushStore.getState();
  const [testResult, setTestResult] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ModalShell
      onClose={onClose}
      labelledBy={titleId}
      overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-end sm:items-center justify-center p-2 sm:p-4 cursor-pointer"
      panelClassName="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[calc(100dvh-1rem)] cursor-default"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
        <h2 id={titleId} className="font-bold text-base text-slate-900 dark:text-slate-100">푸시 알림</h2>
        <button type="button" onClick={onClose} aria-label="닫기" className="p-2 -mr-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-5 overflow-y-auto">
        {status === 'loading' && <p className="text-sm text-slate-500 dark:text-slate-400">알림 상태를 확인하는 중…</p>}

        {status !== 'loading' && status !== 'on' && status !== 'off' && (
          <p role="status" className="rounded-lg bg-slate-100 dark:bg-slate-800/70 px-3 py-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{STATUS_TEXT[status]}</p>
        )}

        {status === 'off' && (
          <>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">블로그를 닫아 둬도 댓글·답글·좋아요·새 팔로워를 이 기기로 알려 드려요.</p>
            <button type="button" onClick={() => void enable()} disabled={busy} className={`${BUTTON} bg-emerald-600 text-white hover:bg-emerald-500`}>
              {busy ? '켜는 중…' : '이 기기에서 알림 받기'}
            </button>
          </>
        )}

        {status === 'on' && (
          <>
            <p role="status" className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">이 기기에서 알림을 받고 있어요.</p>
            {preferences !== null && (
              <fieldset className="flex flex-col gap-1 min-w-0">
                <legend className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">받을 알림</legend>
                {PREFERENCE_LABELS.map(({ key, label, hint }) => (
                  <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 pointer-coarse:min-h-11">
                    <input
                      type="checkbox"
                      checked={preferences[key]}
                      onChange={(event) => void setPreference(key, event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                    />
                    <span className="flex flex-col min-w-0">
                      <span className="text-sm text-slate-900 dark:text-slate-100">{label}</span>
                      <span className="text-xs text-slate-500">{hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <div className="flex flex-col min-[400px]:flex-row gap-2">
              <button type="button" disabled={busy} onClick={() => void sendTest().then(setTestResult)}
                className={`${BUTTON} flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700`}>
                시험 알림 보내기
              </button>
              <button type="button" disabled={busy} onClick={() => void disable()}
                className={`${BUTTON} flex-1 text-rose-600 dark:text-rose-300 ring-1 ring-slate-200 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800`}>
                이 기기 알림 끄기
              </button>
            </div>
            {testResult !== null && <p role="status" className="text-xs text-slate-500 dark:text-slate-400">{testResult}</p>}
          </>
        )}

        {error !== null && <p role="alert" className="rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">{error}</p>}
      </div>
    </ModalShell>
  );
};

/**
 * 설정 대화상자(열림 상태는 pushStore). 헤더의 backdrop-blur 가 fixed 자식의 기준을 헤더로 바꾸므로 body 로 옮겨 그린다.
 */
export const PushSettingsHost: React.FC = () => {
  const open = usePushStore((state) => state.settingsOpen);
  const close = usePushStore((state) => state.closeSettings);
  return open ? createPortal(<PushSettingsDialog onClose={close} />, document.body) : null;
};
