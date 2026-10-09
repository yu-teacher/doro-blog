import React from 'react';
import { ArrowLeft, Check, FileText, Loader2 } from 'lucide-react';

interface EditorActionBarProps {
  serverDraftCount: number;
  /** 자동 저장 진행 중 여부. */
  autoSaving: boolean;
  /** 마지막 자동 저장 결과를 나타내는 문구 (없으면 표시하지 않는다). */
  autoSavedLabel: string | null;
  saving: boolean;
  onExit: () => void;
  onOpenDrafts: () => void;
  onSaveDraft: () => void;
  /** false 면 임시저장 버튼을 막는다(이미 출간·비공개인 글은 임시저장으로 되돌릴 수 없다). 기본 true. */
  canSaveDraft?: boolean;
  onOpenPublish: () => void;
}

/** 에디터 하단 고정 바: 나가기, 임시 글 목록, 자동 저장 상태, 임시저장/출간 버튼. */
export const EditorActionBar: React.FC<EditorActionBarProps> = ({
  serverDraftCount,
  autoSaving,
  autoSavedLabel,
  saving,
  onExit,
  onOpenDrafts,
  onSaveDraft,
  canSaveDraft = true,
  onOpenPublish,
}) => (
<footer className="h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between z-20">
    <button
      onClick={() => onExit()}
      className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors"
    >
      <ArrowLeft className="w-4 h-4" /> 나가기
    </button>

    <div className="flex items-center gap-3">
      {serverDraftCount > 0 && (
        <button
          type="button"
          onClick={() => onOpenDrafts()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors mr-1 shadow-2xs"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>임시 글 목록</span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
            {serverDraftCount}
          </span>
        </button>
      )}

      {autoSaving && (
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mr-2 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>DB 동기화 중...</span>
        </span>
      )}

      {!autoSaving && autoSavedLabel && (
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mr-2">
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          <span>{autoSavedLabel}</span>
        </span>
      )}

      <button
        onClick={onSaveDraft}
        disabled={saving || !canSaveDraft}
        title={canSaveDraft ? undefined : "이미 출간된 글은 임시저장으로 되돌릴 수 없습니다. 수정한 내용은 '출간하기'로 반영해 주세요."}
        className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        임시저장
      </button>
      <button
        onClick={onOpenPublish}
        disabled={saving}
        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
      >
        출간하기
      </button>
    </div>
  </footer>
);
