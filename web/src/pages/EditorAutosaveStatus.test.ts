import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { PageResponse, PostStatus, PostSummary, UserProfile } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { EditorPage } from './EditorPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const AUTOSAVE_WAIT_MS = 15_000; // 서버 자동 저장 지연(5초)보다 충분히 길게

const emptyPage: PageResponse<PostSummary> = { content: [], totalElements: 0, totalPages: 0, size: 10, number: 0, first: true, last: true, empty: true };
const user: UserProfile = { id: 'u1', username: 'tester', email: 't@doro.test', nickname: 'tester', blogTitle: 'tester.log', followerCount: 0, followingCount: 0, createdAt: '2026-01-01T00:00:00Z' };

let root: Root | undefined;
let host: HTMLElement | undefined;

async function openEditorFor(status: PostStatus) {
  vi.spyOn(blogApi, 'getPostById').mockResolvedValue({
    post: { id: 'p1', title: '기존 글', slug: 's', summary: '요약', thumbnailUrl: null, status, tags: [], seriesId: null } as unknown as PostSummary,
    content: '기존 본문',
    likedByMe: false,
    author: null,
  } as never);
  const update = vi.spyOn(blogApi, 'updatePost').mockResolvedValue({} as never);
  vi.spyOn(blogApi, 'createPost').mockResolvedValue({ id: 'new' } as never);

  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MemoryRouter, { initialEntries: ['/edit/p1'] }, createElement(Routes, null,
      createElement(Route, { path: '/edit/:id', element: createElement(EditorPage) }))));
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(AUTOSAVE_WAIT_MS); });
  return update;
}

describe('수정 화면 자동 저장과 글 상태', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: true, user });
    vi.spyOn(blogApi, 'getMyPosts').mockResolvedValue(emptyPage);
    vi.spyOn(blogApi, 'getUserSeries').mockResolvedValue([]);
  });
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each<PostStatus>(['PUBLISHED', 'PRIVATE'])('%s 글은 열어 두기만 해도 임시저장(DRAFT)으로 되돌려지지 않는다', async (status) => {
    const update = await openEditorFor(status);

    expect(update).not.toHaveBeenCalled();
  });

  it('DRAFT 글은 여전히 자동 저장되고, DRAFT 상태를 유지한다', async () => {
    const update = await openEditorFor('DRAFT');

    expect(update).toHaveBeenCalled();
    expect(update.mock.calls.every((c) => (c[1] as { status?: string }).status === 'DRAFT')).toBe(true);
  });
});
