import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { SeriesDetail, UserProfile } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { SeriesDetailPage } from './SeriesDetailPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const detail = {
  series: { id: 's1', userId: 'owner', username: 'owner', title: '연재', slug: 'serial', postCount: 1, updatedAt: '2026-01-01T00:00:00Z' },
  posts: [{ id: 'p1', seriesOrder: 1, title: '첫 글', slug: 'first', status: 'PUBLISHED', publishedAt: '2026-01-01T00:00:00Z' }],
} as unknown as SeriesDetail;

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MemoryRouter, { initialEntries: ['/owner/series/serial'] },
      createElement(Routes, null, createElement(Route, { path: '/:username/series/:slug', element: createElement(SeriesDetailPage) }))));
  });
  // 데이터 요청이 끝나고 화면이 바뀔 때까지 기다린다
  for (let i = 0; i < 5; i++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }
}

const manageButton = () => [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('시리즈 관리'));

beforeEach(() => {
  vi.spyOn(blogApi, 'getSeriesBySlug').mockResolvedValue(detail);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  useAuthStore.setState({ isAuthenticated: false, user: null });
});

describe('SeriesDetailPage 관리 모드', () => {
  it('시리즈 주인에게만 "시리즈 관리" 버튼이 보이고, 누르면 편집 화면으로 바뀐다', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'owner', username: 'owner' } as unknown as UserProfile });
    await render();

    expect(manageButton()).toBeDefined();
    expect(host!.querySelector('[aria-label="시리즈 글 관리"]')).toBeNull();

    await act(async () => { manageButton()!.click(); });

    expect(host!.querySelector('[aria-label="시리즈 글 관리"]')).not.toBeNull();
    expect(host!.querySelector('button[aria-label="첫 글 시리즈에서 빼기"]')).not.toBeNull();
  });

  it('다른 사용자나 비로그인 방문자에게는 관리 버튼이 없고 읽기 화면만 보인다', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'visitor', username: 'visitor' } as unknown as UserProfile });
    await render();
    expect(manageButton()).toBeUndefined();
    expect(host!.textContent).toContain('첫 글');

    act(() => root?.unmount());
    host?.remove();
    useAuthStore.setState({ isAuthenticated: false, user: null });
    await render();
    expect(manageButton()).toBeUndefined();
  });
});
