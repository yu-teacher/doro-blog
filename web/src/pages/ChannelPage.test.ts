import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { PageResponse, PostSummary, UserProfile } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { ChannelPage } from './ChannelPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const profile: UserProfile = {
  id: 'u1',
  username: 'writer',
  email: 'w@doro.test',
  nickname: '작가님',
  blogTitle: 'writer.log',
  followerCount: 3,
  followingCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
};

const post = (id: string, title: string) =>
  ({ id, title, slug: id, username: 'writer', nickname: '작가님', summary: '요약', tags: ['spring'], status: 'PUBLISHED',
     viewCount: 0, likeCount: 0, commentCount: 0, createdAt: '2026-01-01T00:00:00Z', publishedAt: '2026-01-01T00:00:00Z' }) as unknown as PostSummary;

const page = (content: PostSummary[]): PageResponse<PostSummary> => ({
  content, totalElements: content.length, totalPages: 1, size: 12, number: 0, first: true, last: true, empty: content.length === 0,
});

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render(path: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MemoryRouter, { initialEntries: [path] },
      createElement(Routes, null, createElement(Route, { path: '/:username', element: createElement(ChannelPage) }))));
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('ChannelPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null, token: null, refreshToken: null });
    vi.spyOn(blogApi, 'getUserTags').mockResolvedValue([{ name: 'spring', postCount: 2 }] as never);
    vi.spyOn(blogApi, 'getUserActivity').mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    vi.restoreAllMocks();
  });

  it('프로필과 글 목록을 보여준다', async () => {
    vi.spyOn(blogApi, 'getUserProfile').mockResolvedValue(profile);
    vi.spyOn(blogApi, 'getUserPosts').mockResolvedValue(page([post('p1', '첫 번째 글'), post('p2', '두 번째 글')]));
    await render('/@writer');

    expect(host!.textContent).toContain('작가님');
    expect(host!.textContent).toContain('첫 번째 글');
    expect(host!.textContent).toContain('두 번째 글');
    expect(host!.textContent).toContain('팔로워');
  });

  it('시리즈 탭에서만 시리즈를 불러온다', async () => {
    vi.spyOn(blogApi, 'getUserProfile').mockResolvedValue(profile);
    vi.spyOn(blogApi, 'getUserPosts').mockResolvedValue(page([]));
    const getUserSeries = vi.spyOn(blogApi, 'getUserSeries').mockResolvedValue([
      { id: 's1', slug: 'docker', title: '도커 시리즈', description: '', postCount: 2, updatedAt: '2026-01-01T00:00:00Z' } as never,
    ]);

    await render('/@writer');
    expect(getUserSeries).not.toHaveBeenCalled();

    const seriesTab = [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('시리즈')) as HTMLButtonElement;
    await act(async () => { seriesTab.click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(getUserSeries).toHaveBeenCalledTimes(1);
    expect(host!.textContent).toContain('도커 시리즈');
  });

  it('존재하지 않는 채널이면 서버 메시지와 다시 시도 버튼을 보여준다', async () => {
    vi.spyOn(blogApi, 'getUserProfile').mockRejectedValue(new Error('존재하지 않는 사용자입니다.'));
    vi.spyOn(blogApi, 'getUserPosts').mockResolvedValue(page([]));
    await render('/@nobody');

    expect(host!.textContent).toContain('존재하지 않는 사용자입니다.');
    expect([...host!.querySelectorAll('button')].some((b) => b.textContent?.includes('다시 시도'))).toBe(true);
  });
});
