import React, { useState } from 'react';
import { X } from 'lucide-react';
import { blogApi } from '../../api/blogApi';
import type { Series } from '../../api/types';
import { getErrorMessage } from '../../utils/errors';
import { ModalShell } from '../ModalShell';

export const SERIES_TITLE_MAX = 100;
export const SERIES_DESCRIPTION_MAX = 2000;
const TITLE_ID = 'series-form-title';

interface SeriesFormModalProps {
  /** 있으면 그 시리즈의 정보를 수정하고, 없으면 새 시리즈를 만든다 */
  series?: Series;
  onSaved: (series: Series) => void;
  onClose: () => void;
}

/**
 * 시리즈의 제목과 설명을 받아 만들거나 수정한다. 주소(슬러그)는 만들 때 제목에서 서버가 정하고, 수정해도 바꾸지 않는다
 * (바꾸면 이미 공유한 링크가 깨진다).
 */
export const SeriesFormModal: React.FC<SeriesFormModalProps> = ({ series, onSaved, onClose }) => {
  const isEdit = series !== undefined;
  const [title, setTitle] = useState(series?.title ?? '');
  const [description, setDescription] = useState(series?.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  // 수정할 때는 실제로 바뀐 것이 있어야 저장할 수 있다
  const changed = !isEdit || trimmedTitle !== series.title || trimmedDescription !== (series.description ?? '').trim();
  const canSubmit = trimmedTitle.length > 0 && changed && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // 수정에서는 빈 설명도 그대로 보내야 설명을 지울 수 있다(서버는 null 을 "그대로 둠"으로 본다)
      const saved = isEdit
        ? await blogApi.updateSeries(series.id, { title: trimmedTitle, description: trimmedDescription })
        : await blogApi.createSeries({ title: trimmedTitle, description: trimmedDescription || undefined });
      onSaved(saved);
    } catch (err: unknown) {
      setError(getErrorMessage(err, isEdit ? '시리즈를 수정하지 못했습니다.' : '시리즈를 만들지 못했습니다.'));
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      labelledBy={TITLE_ID}
      closeOnOverlayClick={false}
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      panelClassName="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl"
    >
      <form onSubmit={submit}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id={TITLE_ID} className="text-lg font-bold text-slate-900 dark:text-white">{isEdit ? '시리즈 정보 수정' : '새 시리즈 만들기'}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="series-title" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">제목</label>
            <input
              id="series-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={SERIES_TITLE_MAX}
              placeholder="예: 스프링 부트 시작하기"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="series-description" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              설명 <span className="font-normal text-slate-400">(선택)</span>
            </label>
            <textarea
              id="series-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={SERIES_DESCRIPTION_MAX}
              rows={3}
              placeholder="이 시리즈에서 다루는 내용을 짧게 적어 보세요."
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? (isEdit ? '저장하는 중…' : '만드는 중…') : isEdit ? '저장' : '만들기'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
