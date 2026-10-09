import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, GripVertical, Lock, Plus, X } from 'lucide-react';
import { blogApi } from '../../api/blogApi';
import type { PostSummary, SeriesDetail, SeriesItemPost } from '../../api/types';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../../utils/notify';
import { moveItem } from '../../utils/reorder';
import { AddSeriesPostModal } from './AddSeriesPostModal';

interface SeriesPostManagerProps {
  detail: SeriesDetail;
  username: string;
  /** 추가·제거·정렬이 서버에 반영될 때마다 서버가 돌려준 최신 상세를 넘긴다 */
  onChange: (detail: SeriesDetail) => void;
}

const REMOVE_CONFIRM = '이 글을 시리즈에서 뺍니다. 글은 삭제되지 않고, 남은 글의 회차가 다시 매겨집니다.';

/**
 * 시리즈 주인이 글을 추가·제거하고 순서를 바꾸는 편집 화면.
 * 순서는 끌어서 놓거나(드래그 앤 드롭), 터치 화면과 키보드를 위한 위/아래 버튼으로 바꾼다.
 * 서버 요청이 진행되는 동안에는 다른 변경을 막아, 요청끼리 순서가 뒤섞이지 않게 한다.
 */
export const SeriesPostManager: React.FC<SeriesPostManagerProps> = ({ detail, username, onChange }) => {
  const seriesId = detail.series.id;
  const [items, setItems] = useState<readonly SeriesItemPost[]>(detail.posts);
  const [busy, setBusy] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [pendingAddId, setPendingAddId] = useState<string | null>(null);

  // 서버에서 새 상세가 오면(추가·제거·정렬 성공) 화면의 목록도 그것으로 맞춘다
  useEffect(() => {
    setItems(detail.posts);
  }, [detail.posts]);

  const run = async (action: () => Promise<SeriesDetail>, failure: string, rollback?: () => void) => {
    setBusy(true);
    try {
      onChange(await action());
    } catch (err: unknown) {
      rollback?.();
      notify.error(getErrorMessage(err, failure));
    } finally {
      setBusy(false);
    }
  };

  const reorder = (from: number, to: number) => {
    if (busy) return;
    const next = moveItem(items, from, to);
    if (next === items) return;
    const previous = items;
    setItems(next); // 서버 응답을 기다리지 않고 먼저 보여 준다(실패하면 되돌린다)
    void run(() => blogApi.reorderSeries(seriesId, next.map((p) => p.id)), '순서를 바꾸지 못했습니다.', () => setItems(previous));
  };

  const remove = (post: SeriesItemPost) => {
    if (busy || !window.confirm(REMOVE_CONFIRM)) return;
    void run(() => blogApi.removeSeriesPost(seriesId, post.id), '시리즈에서 글을 빼지 못했습니다.');
  };

  const add = (post: PostSummary) => {
    if (busy) return;
    setPendingAddId(post.id);
    void run(() => blogApi.addSeriesPost(seriesId, post.id), '시리즈에 글을 추가하지 못했습니다.').finally(() => setPendingAddId(null));
  };

  const clearDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <section aria-label="시리즈 글 관리">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          끌어서 순서를 바꾸거나, 화살표 버튼을 쓰세요. 변경은 바로 저장됩니다.
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> 글 추가
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-12 text-center text-slate-400 dark:text-slate-500">시리즈에 아직 글이 없습니다. “글 추가”로 시작하세요.</p>
      ) : (
        <ol className="space-y-3" aria-busy={busy}>
          {items.map((post, idx) => (
            <li
              key={post.id}
              draggable={!busy}
              onDragStart={(e) => {
                setDragIndex(idx);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', post.id); // Firefox 는 데이터를 넣어야 끌기가 시작된다
              }}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault(); // 놓을 수 있는 곳임을 알린다
                e.dataTransfer.dropEffect = 'move';
                setOverIndex(idx);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) reorder(dragIndex, idx);
                clearDrag();
              }}
              onDragEnd={clearDrag}
              data-dragging={dragIndex === idx || undefined}
              className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-3 dark:bg-slate-900 ${
                overIndex === idx && dragIndex !== null && dragIndex !== idx
                  ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'border-slate-200 dark:border-slate-800'
              } ${dragIndex === idx ? 'opacity-50' : ''}`}
            >
              <GripVertical className="w-5 h-5 shrink-0 cursor-grab text-slate-300 dark:text-slate-600" aria-hidden="true" />
              <span className="w-8 shrink-0 text-lg font-bold text-slate-300 dark:text-slate-600">{String(idx + 1).padStart(2, '0')}</span>

              <div className="min-w-0 flex-1">
                <Link
                  to={`/@${username}/${encodeURIComponent(post.slug)}`}
                  className="truncate font-bold text-slate-900 hover:text-emerald-600 dark:text-slate-100 dark:hover:text-emerald-400"
                >
                  {post.title}
                </Link>
                {post.status === 'PRIVATE' && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    <Lock className="w-3 h-3" aria-hidden="true" /> 비공개
                  </span>
                )}
                {post.status === 'DRAFT' && (
                  <span className="ml-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">임시저장</span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => reorder(idx, idx - 1)}
                  disabled={busy || idx === 0}
                  aria-label={`${post.title} 위로 이동`}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <ArrowUp className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => reorder(idx, idx + 1)}
                  disabled={busy || idx === items.length - 1}
                  aria-label={`${post.title} 아래로 이동`}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <ArrowDown className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(post)}
                  disabled={busy}
                  aria-label={`${post.title} 시리즈에서 빼기`}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-950/30"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {adding && (
        <AddSeriesPostModal
          excludePostIds={new Set(items.map((p) => p.id))}
          pendingPostId={pendingAddId}
          onAdd={add}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  );
};
