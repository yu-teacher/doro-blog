import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { SeriesDetail, UserProfile } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { clearToasts, toastMessages } from '../test/toasts';
import { SeriesDetailPage } from './SeriesDetailPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const detail = {
  series: { id: 's1', userId: 'owner', username: 'owner', title: '연재', slug: 'serial', postCount: 1, updatedAt: '2026-01-01T00:00:00Z' },
  posts: [{ id: 'p1', seriesOrder: 1, title: '첫 글', slug: 'first', status: 'PUBLISHED', publishedAt: '2026-01-01T00:00:00Z' }],
} as unknown as SeriesDetail;

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render(path = '/owner/series/serial') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MemoryRouter, { initialEntries: [path] },
      createElement(Routes, null, createElement(Route, { path: '/:username/series/:slug', element: createElement(SeriesDetailPage) }))));
  });
  // 데이터 요청이 끝나고 화면이 바뀔 때까지 기다린다
  for (let i = 0; i < 5; i++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }
}

const manageButton = () => [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('시리즈 관리'));

beforeEach(() => {
  vi.restoreAllMocks();
  clearToasts();
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

  it('시리즈를 만든 직후(?manage=1)에는 주인에게 바로 관리 화면이 열린다', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'owner', username: 'owner' } as unknown as UserProfile });
    await render('/owner/series/serial?manage=1');

    expect(host!.querySelector('[aria-label="시리즈 글 관리"]')).not.toBeNull();
  });

  it('?manage=1 이어도 주인이 아니면 관리 화면은 열리지 않는다', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'visitor', username: 'visitor' } as unknown as UserProfile });
    await render('/owner/series/serial?manage=1');

    expect(host!.querySelector('[aria-label="시리즈 글 관리"]')).toBeNull();
    expect(host!.textContent).toContain('첫 글');
  });

  it('주인은 정보 수정으로 제목을 바꾸고, 글 목록은 그대로 두고 화면의 제목만 갱신된다', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'owner', username: 'owner' } as unknown as UserProfile });
    const saved = { ...detail.series, title: '바뀐 제목' };
    const update = vi.spyOn(blogApi, 'updateSeries').mockResolvedValue(saved as never);
    await render();

    const editButton = [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('정보 수정'))!;
    await act(async () => { editButton.click(); });
    const title = document.getElementById('series-title') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, '바뀐 제목');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { (document.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(update).toHaveBeenCalledWith('s1', { title: '바뀐 제목', description: '' });
    expect(host!.textContent).toContain('바뀐 제목');
    expect(host!.textContent).toContain('첫 글');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('삭제는 확인을 거쳐 서버에 요청하고, 취소하면 아무것도 하지 않는다', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'owner', username: 'owner' } as unknown as UserProfile });
    const del = vi.spyOn(blogApi, 'deleteSeries').mockResolvedValue(undefined);
    await render();
    const deleteButton = () => [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '삭제')!;

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await act(async () => { deleteButton().click(); });
    expect(del).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => { deleteButton().click(); });
    expect(del).toHaveBeenCalledWith('s1');
  });

  it('삭제가 실패하면 이유를 알리고 화면에 남는다', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'owner', username: 'owner' } as unknown as UserProfile });
    vi.spyOn(blogApi, 'deleteSeries').mockRejectedValue(new Error('삭제 권한이 없습니다.'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await render();

    await act(async () => { [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '삭제')!.click(); });
    await act(async () => { await Promise.resolve(); });

    expect(toastMessages()).toContain('삭제 권한이 없습니다.');
    expect(host!.textContent).toContain('연재');
  });

  it('주인이 아니면 정보 수정·삭제 버튼이 없다', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'visitor', username: 'visitor' } as unknown as UserProfile });
    await render();

    const labels = [...host!.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(labels).not.toContain('삭제');
    expect(labels.some((l) => l?.includes('정보 수정'))).toBe(false);
  });
});
