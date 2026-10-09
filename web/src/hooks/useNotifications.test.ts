import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { NotificationItem, PageResponse } from '../api/types';
import { useNotifications, type Notifications } from './useNotifications';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (id: string): NotificationItem =>
  ({ id, type: 'LIKE', sender: { id: 's', username: 'u', nickname: 'n', profileImageUrl: null }, targetPostId: null, targetPostTitle: null, targetPostSlug: null, targetUsername: null, message: null, isRead: false, createdAt: '2026-10-01T00:00:00Z' }) as unknown as NotificationItem;

function pageOf(number: number, ids: string[], totalPages = 3): PageResponse<NotificationItem> {
  return { content: ids.map(item), totalElements: 99, totalPages, size: 15, number, first: number === 0, last: number + 1 >= totalPages, empty: ids.length === 0 };
}

function deferredPage() {
  let resolve!: (p: PageResponse<NotificationItem>) => void;
  const promise = new Promise<PageResponse<NotificationItem>>((res) => { resolve = res; });
  return { promise, resolve };
}

let root: Root | undefined;
let latest: Notifications | undefined;

function mount(enabled = true) {
  root = createRoot(document.createElement('div'));
  function Probe() {
    latest = useNotifications(enabled);
    return null;
  }
  act(() => root!.render(createElement(Probe)));
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('useNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(blogApi, 'getUnreadNotificationCount').mockResolvedValue(0);
  });
  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    latest = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('로그인하지 않으면 아무것도 요청하지 않는다', async () => {
    mount(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(blogApi.getUnreadNotificationCount).not.toHaveBeenCalled();
  });

  it('안 읽은 수는 30초마다 갱신하고, 언마운트하면 멈춘다', async () => {
    mount();
    await flush();
    expect(blogApi.getUnreadNotificationCount).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(blogApi.getUnreadNotificationCount).toHaveBeenCalledTimes(2);

    act(() => root!.unmount());
    root = undefined;
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(blogApi.getUnreadNotificationCount).toHaveBeenCalledTimes(2);
  });

  it('더 보기를 연달아 눌러도(응답 전) 같은 페이지를 두 번 요청하거나 같은 알림을 두 번 넣지 않는다', async () => {
    const first = deferredPage();
    const get = vi.spyOn(blogApi, 'getNotifications').mockResolvedValueOnce(pageOf(0, ['a', 'b'])).mockReturnValueOnce(first.promise);
    mount();
    act(() => latest!.open());
    await flush();
    expect(latest!.items.map((n) => n.id)).toEqual(['a', 'b']);

    act(() => { latest!.loadMore(); latest!.loadMore(); }); // 두 번 눌렀다
    first.resolve(pageOf(1, ['c', 'd']));
    await flush();

    expect(get.mock.calls.filter((c) => c[0] === 1)).toHaveLength(1);
    expect(latest!.items.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('더 보기 응답이 오기 전에 다시 열면, 늦게 도착한 이전 응답이 새 목록 뒤에 붙지 않는다', async () => {
    const stale = deferredPage();
    vi.spyOn(blogApi, 'getNotifications')
      .mockResolvedValueOnce(pageOf(0, ['a', 'b']))   // 처음 열기
      .mockReturnValueOnce(stale.promise)             // 더 보기(1페이지) — 아직 응답 없음
      .mockResolvedValueOnce(pageOf(0, ['x', 'y']));  // 다시 열기
    mount();
    act(() => latest!.open());
    await flush();
    act(() => latest!.loadMore());
    act(() => latest!.open()); // 응답이 오기 전에 다시 열었다
    await flush();
    expect(latest!.items.map((n) => n.id)).toEqual(['x', 'y']);

    stale.resolve(pageOf(1, ['c', 'd'])); // 이전 더 보기 응답이 뒤늦게 도착
    await flush();

    expect(latest!.items.map((n) => n.id)).toEqual(['x', 'y']);
  });
});
