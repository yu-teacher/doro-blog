import React from 'react';
import { ModalShell } from '../ModalShell';
import type { PostSummary } from '../../api/types';
import { formatDate } from '../../utils/date';
import { FileText, Trash2, X } from 'lucide-react';

interface ServerDraftsModalProps {
  serverDrafts: PostSummary[];
  /** 지금 편집 중인 서버 글 id (목록에서 "현재 작성 중"으로 표시한다). */
  currentPostId: string | null;
  onSelect: (draft: PostSummary) => void;
  onDelete: (draftId: string, e: React.MouseEvent) => void;
  onClose: () => void;
}

/** 서버에 저장된 임시 글 목록을 보여주고 골라서 불러오는 모달. */
export const ServerDraftsModal: React.FC<ServerDraftsModalProps> = ({ serverDrafts, currentPostId, onSelect, onDelete, onClose }) => (
    <ModalShell onClose={onClose} labelledBy="server-drafts-title" overlayClassName="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 cursor-pointer" panelClassName="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 cursor-default p-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-500" />
            <h3 id="server-drafts-title" className="text-lg font-bold">서버 DB 임시 글 목록 ({serverDrafts.length})</h3>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => onClose()}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          클릭하면 해당 임시 글을 에디터로 불러옵니다. (현재 작성 중인 내용은 변경됩니다)
        </p>

        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {serverDrafts.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
              저장된 임시 글이 없습니다.
            </div>
          ) : (
            serverDrafts.map((d) => (
              <div
                key={d.id}
                onClick={() => onSelect(d)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 group ${
                  currentPostId === d.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/50'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60 hover:border-emerald-400 dark:hover:border-emerald-600'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1 flex-1">
                    {d.title || '제목 없는 임시 글'}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {currentPostId === d.id && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                        현재 작성 중
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => onDelete(d.id, e)}
                      className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="임시 글 삭제"
                      aria-label="임시 글 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                  <span>
                    {formatDate(d.createdAt, 'dateTimeShort')}
                  </span>
                  {d.tags && d.tags.length > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 truncate max-w-[200px]">
                      {d.tags.map((t: string) => `#${t}`).join(' ')}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ModalShell>
  
);
