import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { PageResponse, PostStatus, PostSummary, UserProfile } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { EditorPage } from './EditorPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const emptyPage: PageResponse<PostSummary> = { content: [], totalElements: 0, totalPages: 0, size: 10, number: 0, first: true, last: true, empty: true };
const user: UserProfile = { id: 'u1', username: 'tester', email: 't@doro.test', nickname: 'tester', blogTitle: 'tester.log', followerCount: 0, followingCount: 0, createdAt: '2026-01-01T00:00:00Z' };

let root: Root | undefined;
let host: HTMLElement | undefined;

async function openEditorFor(status: PostStatus, seriesId: string | null = null) {
  vi.spyOn(blogApi, 'getPostById').mockResolvedValue({
    post: { id: 'p1', title: '기존 글', slug: 's', summary: '요약', thumbnailUrl: null, status, tags: [], seriesId } as unknown as PostSummary,
    content: '기존 본문',
    likedByMe: false,
    author: null,
  } as never);
  const update = vi.spyOn(blogApi, 'updatePost').mockResolvedValue({ id: 'p1', slug: 's' } as never);
  vi.spyOn(blogApi, 'createPost').mockResolvedValue({ id: 'new', slug: 'n' } as never);
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);

  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MemoryRouter, { initialEntries: ['/edit/p1'] }, createElement(Routes, null,
      createElement(Route, { path: '/edit/:id', element: createElement(EditorPage) }))));
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return update;
}

function buttonsWithText(text: string): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter((b) => b.textContent?.includes(text)) as HTMLButtonElement[];
}

async function click(button: HTMLButtonElement) {
  await act(async () => { button.click(); await Promise.resolve(); });
}

describe('에디터의 글 상태와 시리즈', () => {
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

  it('출간된 글에서 "임시저장" 을 눌러도 글이 임시저장(DRAFT)으로 되돌려지지 않는다', async () => {
    const update = await openEditorFor('PUBLISHED');
    const save = buttonsWithText('임시저장');
    expect(save.length, '임시저장 버튼을 찾을 수 있어야 이 테스트가 의미가 있다').toBeGreaterThan(0);

    await click(save[0]);

    expect(update.mock.calls.some((c) => (c[1] as { status?: string }).status === 'DRAFT')).toBe(false);
  });

  it('시리즈를 해제하지 않고 수정해 출간하면 removeFromSeries 를 보내지 않는다 (시리즈 유지)', async () => {
    const update = await openEditorFor('PUBLISHED', 'series-1');
    update.mockClear();
    const open = buttonsWithText('출간하기');
    await click(open[0]);
    const confirm = buttonsWithText('출간하기');
    await click(confirm[confirm.length - 1]);

    const last = update.mock.calls.at(-1);
    expect(last).toBeDefined();
    expect((last![1] as { seriesId?: string }).seriesId).toBe('series-1');
    expect((last![1] as { removeFromSeries?: boolean }).removeFromSeries).toBeUndefined();
  });

  it('임시저장 글을 열어 출간하면 PUBLISHED 로 저장된다', async () => {
    const update = await openEditorFor('DRAFT');
    update.mockClear();
    const open = buttonsWithText('출간하기');
    expect(open.length, '출간하기 버튼을 찾을 수 있어야 이 테스트가 의미가 있다').toBeGreaterThan(0);
    await click(open[0]);
    const confirm = buttonsWithText('출간하기');
    await click(confirm[confirm.length - 1]);

    const last = update.mock.calls.at(-1);
    expect(last, '출간 요청이 updatePost 로 나가야 한다').toBeDefined();
    expect((last![1] as { status?: string }).status).toBe('PUBLISHED');
  });
  it('출간은 성공했는데 로컬 백업을 지우다 저장소 오류가 나도 "출간 실패"로 보이지 않는다 (재시도하면 글이 중복된다)', async () => {
    const update = await openEditorFor('DRAFT');
    update.mockClear();
    const alertSpy = vi.mocked(window.alert);
    alertSpy.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const open = buttonsWithText('출간하기');
    await click(open[0]);
    const confirm = buttonsWithText('출간하기');
    await click(confirm[confirm.length - 1]);

    expect(update).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('실패'))).toEqual([]);
  });
});
