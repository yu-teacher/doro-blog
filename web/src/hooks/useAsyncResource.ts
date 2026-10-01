import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList, Dispatch, SetStateAction } from 'react';
import { getErrorMessage, isCancelled } from '../utils/errors';

export interface AsyncResource<T> {
  data: T | null;
  /** 낙관적 갱신처럼 화면에서 값을 직접 바꿔야 할 때 쓴다 (예: 팔로우 직후 프로필). */
  setData: Dispatch<SetStateAction<T | null>>;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

interface Options {
  /** false 이면 요청하지 않고 data 를 비운다. */
  enabled?: boolean;
}

/**
 * 한 번 불러오는 데이터(프로필, 시리즈 목록 등)의 공통 로직.
 * deps 가 바뀌거나 언마운트되면 진행 중인 요청을 취소(AbortController)하고, 늦게 도착한 이전 응답은 버린다.
 */
export function useAsyncResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  { enabled = true }: Options = {}
): AsyncResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // 의존성 값(사용자명, 필터 등)을 문자열 키로 만들어 effect 의 재실행 조건으로 쓴다
  const depsKey = JSON.stringify(deps);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    setError(null);
    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setData(null);
    setLoading(true);

    fetcherRef.current(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isCancelled(err)) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [depsKey, enabled, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { data, setData, loading, error, reload };
}
