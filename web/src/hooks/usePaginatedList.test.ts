import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PageResponse } from '../api/types';
import { usePaginatedList, type PaginatedList } from './usePaginatedList';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function page(content: string[], last: boolean, totalElements = content.length): PageResponse<string> {
  return { content, totalElements, totalPages: 1, size: content.length, number: 0, first: true, last, empty: content.length === 0 };
}

interface Harness {
  current: () => PaginatedList<string>;
  rerender: (key: string, enabled?: boolean) => void;
  unmount: () => void;
}

/** 훅을 렌더링하는 최소 하네스 (테스트 라이브러리 없이 react-dom 만 사용). */
function mountHook(fetchPage: (key: string, page: number, signal: AbortSignal) => Promise<PageResponse<string>>, firstKey: string): Harness {
  let result: PaginatedList<string> | undefined;
  const container = document.createElement('div');
  const root: Root = createRoot(container);

  function Probe({ itemKey, enabled }: { itemKey: string; enabled: boolean }) {
    result = usePaginatedList<string>((p, signal) => fetchPage(itemKey, p, signal), [itemKey], { enabled });
    return null;
  }

  const render = (key: string, enabled = true) => {
    act(() => root.render(createElement(Probe, { itemKey: key, enabled })));
  };
  render(firstKey);

  return {
    current: () => {
      if (!result) throw new Error('hook not rendered');
      return result;
    },
    rerender: render,
    unmount: () => act(() => root.unmount()),
  };
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('usePaginatedList', () => {
  let harness: Harness | undefined;

  beforeEach(() => {
    harness = undefined;
  });

  afterEach(() => {
    harness?.unmount();
  });

  it('첫 페이지를 불러오고 다음 페이지를 이어 붙인다', async () => {
    const calls: number[] = [];
    harness = mountHook(async (_k, p) => {
      calls.push(p);
      return p === 0 ? page(['a', 'b'], false, 3) : page(['c'], true, 3);
    }, 'x');
    expect(harness.current().loading).toBe(true);
    await flush();

    expect(harness.current().items).toEqual(['a', 'b']);
    expect(harness.current().hasMore).toBe(true);
    expect(harness.current().totalElements).toBe(3);

    act(() => harness!.current().loadMore());
    await flush();
    expect(harness.current().items).toEqual(['a', 'b', 'c']);
    expect(harness.current().hasMore).toBe(false);
    expect(calls).toEqual([0, 1]);
  });

  it('필터가 바뀐 뒤 늦게 도착한 이전 응답은 무시한다', async () => {
    const pending = new Map<string, Deferred<PageResponse<string>>>();
    harness = mountHook((key) => {
      const d = deferred<PageResponse<string>>();
      pending.set(key, d);
      return d.promise;
    }, 'old');

    harness.rerender('new');
    pending.get('new')!.resolve(page(['new-1'], true));
    await flush();
    pending.get('old')!.resolve(page(['old-1', 'old-2'], true)); // 늦게 도착
    await flush();

    expect(harness.current().items).toEqual(['new-1']);
  });

  it('필터가 바뀌면 진행 중이던 요청의 signal 이 abort 된다', async () => {
    const signals: AbortSignal[] = [];
    harness = mountHook((_k, _p, signal) => {
      signals.push(signal);
      return new Promise(() => undefined);
    }, 'a');

    harness.rerender('b');
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
  });

  it('더 불러오는 중에 필터가 바뀌면 이전 필터의 결과를 새 목록에 붙이지 않는다', async () => {
    const pending = new Map<string, Deferred<PageResponse<string>>>();
    harness = mountHook((key, p) => {
      if (key === 'old' && p === 0) return Promise.resolve(page(['o1'], false));
      const d = deferred<PageResponse<string>>();
      pending.set(`${key}:${p}`, d);
      return d.promise;
    }, 'old');
    await flush();

    act(() => harness!.current().loadMore()); // old:1 대기
    harness.rerender('new');
    pending.get('new:0')!.resolve(page(['n1'], true));
    await flush();
    pending.get('old:1')!.resolve(page(['o2'], true)); // 늦게 도착
    await flush();

    expect(harness.current().items).toEqual(['n1']);
  });

  it('첫 페이지 실패는 error 로 노출되고 reload 로 다시 시도할 수 있다', async () => {
    let attempt = 0;
    harness = mountHook(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('서버 오류');
      return page(['ok'], true);
    }, 'x');
    await flush();
    expect(harness.current().error).toBe('서버 오류');
    expect(harness.current().items).toEqual([]);
    expect(harness.current().loading).toBe(false);

    act(() => harness!.current().reload());
    await flush();
    expect(harness.current().error).toBeNull();
    expect(harness.current().items).toEqual(['ok']);
  });

  it('다음 페이지 실패 시 error 가 노출되고, 다시 시도하면 같은 페이지를 요청해 이어 붙인다', async () => {
    const requested: number[] = [];
    let failNext = true;
    harness = mountHook(async (_k, p) => {
      requested.push(p);
      if (p === 0) return page(['a'], false);
      if (failNext) throw new Error('일시 오류');
      return page(['b'], true);
    }, 'x');
    await flush();

    act(() => harness!.current().loadMore());
    await flush();
    expect(harness.current().error).toBe('일시 오류');
    expect(harness.current().items).toEqual(['a']);
    expect(harness.current().hasMore).toBe(true);

    failNext = false;
    act(() => harness!.current().loadMore());
    await flush();
    expect(harness.current().error).toBeNull();
    expect(harness.current().items).toEqual(['a', 'b']);
    expect(requested).toEqual([0, 1, 1]);
  });

  it('enabled 가 false 이면 요청하지 않고 빈 목록이다', async () => {
    let calls = 0;
    harness = mountHook(async () => {
      calls += 1;
      return page(['a'], true);
    }, 'x');
    await flush();
    harness.rerender('x', false);
    await flush();

    expect(calls).toBe(1);
    expect(harness.current().items).toEqual([]);
    expect(harness.current().loading).toBe(false);
  });

  it('언마운트되면 진행 중인 요청을 abort 한다', async () => {
    let signal: AbortSignal | undefined;
    harness = mountHook((_k, _p, s) => {
      signal = s;
      return new Promise(() => undefined);
    }, 'x');
    harness.unmount();
    harness = undefined;
    expect(signal!.aborted).toBe(true);
  });
});
