import { useCallback, useEffect, useRef, useState } from 'react';
import { blogApi } from '../api/blogApi';
import type { PostSummary } from '../api/types';
import { isCancelled } from '../utils/errors';

const SERVER_DRAFTS_LIMIT = 10;

export interface ServerDrafts {
  drafts: PostSummary[];
  /** 목록을 다시 불러온다. 기존 목록은 새 응답이 올 때까지 그대로 보인다. */
  refresh: () => void;
  /** 삭제 직후 화면에서 바로 뺀다. */
  removeLocally: (id: string) => void;
}

/** 서버에 저장된 임시 글 목록 (최근 10개). 로그인한 동안에만 불러온다. */
export function useServerDrafts(enabled: boolean): ServerDrafts {
  const [drafts, setDrafts] = useState<PostSummary[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    blogApi
      .getMyPosts('DRAFT', 0, SERVER_DRAFTS_LIMIT, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setDrafts(res.content ?? []);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isCancelled(err)) return;
        console.error('Failed to load server drafts', err);
      });
  }, []);

  useEffect(() => {
    if (enabled) refresh();
    return () => controllerRef.current?.abort();
  }, [enabled, refresh]);

  const removeLocally = useCallback((id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id)), []);

  return { drafts, refresh, removeLocally };
}
