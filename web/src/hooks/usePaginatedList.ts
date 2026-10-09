import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList, Dispatch, SetStateAction } from 'react';
import type { PageResponse } from '../api/types';
import { getErrorMessage, isCancelled } from '../utils/errors';

/** 항목의 id. id 가 있는 항목은 이어 붙일 때 이미 받은 항목을 걸러 내는 데 쓴다. 없으면(문자열 등) 거르지 않는다. */
function itemKey(item: unknown): string | null {
  if (typeof item === 'object' && item !== null && 'id' in item) {
    const id = (item as { id: unknown }).id;
    if (typeof id === 'string' || typeof id === 'number') return String(id);
  }
  return null;
}

/** 다음 페이지를 이어 붙인다. 목록이 밀려 앞 페이지의 항목이 다시 오면(같은 id) 한 번만 보여 준다. */
function appendPage<T>(prev: T[], next: T[]): T[] {
  const known = new Set<string>();
  for (const item of prev) {
    const key = itemKey(item);
    if (key !== null) known.add(key);
  }
  return [...prev, ...next.filter((item) => {
    const key = itemKey(item);
    return key === null || !known.has(key);
  })];
}

/** 더 불러올 페이지가 있는가. 서버가 last=false 라고 해도 내용이 빈 페이지면 끝이다(무한 스크롤이 빈 요청을 계속 보내지 않게). */
function hasNextPage<T>(res: PageResponse<T>): boolean {
  return !res.last && (res.content?.length ?? 0) > 0;
}

export type PageFetcher<T> = (page: number, signal: AbortSignal) => Promise<PageResponse<T>>;

interface Options<T> {
  /** false 이면 요청하지 않고 빈 목록으로 둔다 (예: 로그인이 필요한 탭에서 비로그인). */
  enabled?: boolean;
  /** 첫 페이지를 받았을 때 한 번 호출된다 (분석 이벤트 등). 최신 응답에 대해서만 호출된다. */
  onFirstPage?: (res: PageResponse<T>) => void;
}

export interface PaginatedList<T> {
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  totalElements: number;
  hasMore: boolean;
  /** 첫 페이지를 불러오는 중. */
  loading: boolean;
  /** 다음 페이지를 불러오는 중. */
  loadingMore: boolean;
  /** 마지막 요청의 오류 메시지. 성공하면 null. */
  error: string | null;
  loadMore: () => void;
  /** 첫 페이지부터 다시 불러온다. */
  reload: () => void;
}

/**
 * 무한 스크롤 목록의 공통 로직. deps 가 바뀌면 진행 중인 요청을 취소(AbortController)하고 처음부터 다시 불러온다.
 * 늦게 도착한 이전 요청의 응답이 최신 목록을 덮어쓰지 못하고, 언마운트 후에는 상태를 갱신하지 않는다.
 */
export function usePaginatedList<T>(
  fetchPage: PageFetcher<T>,
  deps: DependencyList,
  { enabled = true, onFirstPage }: Options<T> = {}
): PaginatedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // 의존성 값(필터, 탭, 검색어 등)을 문자열 키로 만들어 effect 의 재실행 조건으로 쓴다
  const depsKey = JSON.stringify(deps);

  // 최신 콜백/상태를 effect 의존성에 넣지 않고 읽기 위한 ref
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const onFirstPageRef = useRef(onFirstPage);
  onFirstPageRef.current = onFirstPage;

  const controllerRef = useRef<AbortController | null>(null);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    controllerRef.current?.abort();
    busyRef.current = false;
    pageRef.current = 0;
    hasMoreRef.current = false;
    setError(null);
    setLoadingMore(false);

    if (!enabled) {
      controllerRef.current = null;
      setItems([]);
      setTotalElements(0);
      setHasMore(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setItems([]);
    setTotalElements(0);
    setHasMore(false);
    setLoading(true);
    busyRef.current = true;

    fetchRef.current(0, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setItems(res.content ?? []);
        setTotalElements(res.totalElements);
        hasMoreRef.current = hasNextPage(res);
        setHasMore(hasNextPage(res));
        onFirstPageRef.current?.(res);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isCancelled(err)) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        busyRef.current = false;
        setLoading(false);
      });

    return () => controller.abort();
  }, [depsKey, enabled, reloadKey]);

  const loadMore = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted || busyRef.current || !hasMoreRef.current) return;

    busyRef.current = true;
    setLoadingMore(true);
    setError(null);
    const nextPage = pageRef.current + 1;

    fetchRef.current(nextPage, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        pageRef.current = nextPage;
        setItems((prev) => appendPage(prev, res.content ?? []));
        hasMoreRef.current = hasNextPage(res);
        setHasMore(hasNextPage(res));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isCancelled(err)) return;
        // hasMore 는 그대로 둔다. 소비자는 error 가 있는 동안 자동 로딩(스크롤 감지)을 멈추고,
        // 사용자가 다시 시도하면 loadMore 가 같은 페이지를 다시 요청한다.
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        busyRef.current = false;
        setLoadingMore(false);
      });
  }, []);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { items, setItems, totalElements, hasMore, loading, loadingMore, error, loadMore, reload };
}
