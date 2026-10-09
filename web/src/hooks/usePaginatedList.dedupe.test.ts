import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { PageResponse } from '../api/types';
import { usePaginatedList, type PaginatedList } from './usePaginatedList';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Row { id: string }

const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id }));

function page(content: Row[], last: boolean): PageResponse<Row> {
  return { content, totalElements: 99, totalPages: 9, size: content.length, number: 0, first: true, last, empty: content.length === 0 };
}

let root: Root | undefined;
let latest: PaginatedList<Row> | undefined;
let calls: number[] = [];

function mount(fetchPage: (p: number) => Promise<PageResponse<Row>>) {
  calls = [];
  root = createRoot(document.createElement('div'));
  function Probe() {
    latest = usePaginatedList<Row>((p) => {
      calls.push(p);
      return fetchPage(p);
    }, ['k']);
    return null;
  }
  act(() => root!.render(createElement(Probe)));
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  latest = undefined;
});

describe('usePaginatedList 중복·빈 페이지', () => {
  it('목록이 밀려 다음 페이지에 이미 받은 글이 다시 오면 이어 붙이지 않는다 (같은 글이 두 번 보이면 안 된다)', async () => {
    mount(async (p) => (p === 0 ? page(rows('a', 'b', 'c'), false) : page(rows('c', 'd'), true)));
    await flush();

    act(() => latest!.loadMore());
    await flush();

    expect(latest!.items.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('내용이 빈 페이지는 서버가 last=false 라고 해도 더 불러올 게 없다 (무한 스크롤이 계속 요청하지 않게)', async () => {
    mount(async (p) => (p === 0 ? page(rows('a'), false) : page([], false)));
    await flush();
    expect(latest!.hasMore).toBe(true);

    act(() => latest!.loadMore());
    await flush();

    expect(latest!.hasMore).toBe(false);
    act(() => latest!.loadMore());
    await flush();
    expect(calls).toEqual([0, 1]);
  });

  it('첫 페이지가 비어 있으면 last=false 여도 더 불러오지 않는다', async () => {
    mount(async () => page([], false));
    await flush();

    expect(latest!.hasMore).toBe(false);
  });
});
