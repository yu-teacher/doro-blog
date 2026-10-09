import React from 'react';
import { Lock, X } from 'lucide-react';
import { blogApi } from '../../api/blogApi';
import type { PostSummary } from '../../api/types';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { ModalShell } from '../ModalShell';
import { ErrorState } from '../ErrorState';

const PAGE_SIZE = 20;
const TITLE_ID = 'add-series-post-title';

interface AddSeriesPostModalProps {
  /** 이미 이 시리즈에 들어 있어 목록에서 숨길 글 id (추가한 글이 바로 사라지게 한다) */
  excludePostIds: ReadonlySet<string>;
  /** 지금 추가 요청을 보내는 중인 글의 id (버튼을 잠근다) */
  pendingPostId: string | null;
  onAdd: (post: PostSummary) => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = { DRAFT: '임시저장', PRIVATE: '비공개' };

/** 시리즈에 아직 속하지 않은 내 글(출간·임시저장·비공개)을 골라 추가하는 대화상자. */
export const AddSeriesPostModal: React.FC<AddSeriesPostModalProps> = ({ excludePostIds, pendingPostId, onAdd, onClose }) => {
  const { items, hasMore, loading, loadingMore, error, loadMore, reload } = usePaginatedList<PostSummary>(
    (page, signal) => blogApi.getMyPosts(undefined, page, PAGE_SIZE, signal),
    []
  );
  // 이미 다른 시리즈에 있는 글은 먼저 그 시리즈에서 빼야 하므로 목록에서 숨긴다
  const candidates = items.filter((post) => !post.seriesId && !excludePostIds.has(post.id));

  return (
    <ModalShell
      onClose={onClose}
      labelledBy={TITLE_ID}
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      panelClassName="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <h2 id={TITLE_ID} className="text-lg font-bold text-slate-900 dark:text-white">시리즈에 글 추가</h2>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="overflow-y-auto px-5 py-4">
        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-slate-400">글 목록을 불러오는 중입니다</p>
        ) : error && items.length === 0 ? (
          <ErrorState message={error} onRetry={reload} />
        ) : candidates.length === 0 && !hasMore ? (
          <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            추가할 수 있는 글이 없습니다. 시리즈에 속하지 않은 글만 보여 줍니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {candidates.map((post) => (
              <li
                key={post.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{post.title}</p>
                  {STATUS_LABEL[post.status] && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {post.status === 'PRIVATE' && <Lock className="w-3 h-3" aria-hidden="true" />}
                      {STATUS_LABEL[post.status]}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onAdd(post)}
                  disabled={pendingPostId !== null}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {pendingPostId === post.id ? '추가 중…' : '추가'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-4 w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {loadingMore ? '불러오는 중…' : '더 보기'}
          </button>
        )}
        {error && items.length > 0 && <p role="alert" className="mt-3 text-center text-sm text-red-500">{error}</p>}
      </div>
    </ModalShell>
  );
};
