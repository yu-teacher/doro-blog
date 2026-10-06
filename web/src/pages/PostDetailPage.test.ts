import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { PostDetail } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { PostDetailPage } from './PostDetailPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const detail = (over: Partial<PostDetail['post']> = {}): PostDetail =>
  ({
    post: { id: 'p1', userId: 'author1', username: 'writer', nickname: '작가', title: '테스트 글 제목', slug: 'test-post', summary: '요약',
            thumbnailUrl: null, status: 'PUBLISHED', tags: ['spring'], seriesId: null, viewCount: 7, likeCount: 2, commentCount: 0,
            publishedAt: '2026-01-02T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', ...over },
    content: '본문 **강조**',
    likedByMe: false,
    author: { bio: '소개글', isFollowing: false },
  }) as unknown as PostDetail;

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render(path = '/@writer/test-post') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MemoryRouter, { initialEntries: [path] },
      createElement(Routes, null, createElement(Route, { path: '/:username/:slug', element: createElement(PostDetailPage) }))));
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}

describe('PostDetailPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null });
    vi.spyOn(blogApi, 'getComments').mockResolvedValue([]);
    vi.spyOn(blogApi, 'getRelatedPosts').mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    vi.restoreAllMocks();
  });

  it('글 제목, 본문, 작성자 소개를 보여준다', async () => {
    vi.spyOn(blogApi, 'getPostBySlug').mockResolvedValue(detail());
    await render();

    expect(host!.querySelector('h1')?.textContent).toContain('테스트 글 제목');
    expect(host!.textContent).toContain('강조');
    expect(host!.textContent).toContain('소개글');
    expect(document.title).toContain('테스트 글 제목');
  });

  it('시리즈에 속한 글이면 시리즈 박스를 보여준다', async () => {
    vi.spyOn(blogApi, 'getPostBySlug').mockResolvedValue(detail({ seriesId: 's1' }));
    vi.spyOn(blogApi, 'getSeries').mockResolvedValue({
      series: { id: 's1', slug: 'docker', title: '도커 시리즈', postCount: 1 },
      posts: [{ id: 'p1', seriesOrder: 1, title: '테스트 글 제목', slug: 'test-post', status: 'PUBLISHED' }],
    } as never);
    await render();

    expect(host!.textContent).toContain('도커 시리즈');
  });

  it('댓글/추천 불러오기가 실패해도 글은 그대로 보인다', async () => {
    vi.spyOn(blogApi, 'getPostBySlug').mockResolvedValue(detail());
    vi.spyOn(blogApi, 'getComments').mockRejectedValue(new Error('comments down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await render();

    expect(host!.querySelector('h1')?.textContent).toContain('테스트 글 제목');
  });

  it('글을 불러오지 못하면 서버 메시지와 다시 시도 버튼을 보여준다', async () => {
    vi.spyOn(blogApi, 'getPostBySlug').mockRejectedValue(new Error('존재하지 않는 게시글입니다.'));
    await render();

    expect(host!.textContent).toContain('존재하지 않는 게시글입니다.');
    expect([...host!.querySelectorAll('button')].some((b) => b.textContent?.includes('다시 시도'))).toBe(true);
  });

  it('공유 버튼은 현재 주소를 복사한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.spyOn(blogApi, 'getPostBySlug').mockResolvedValue(detail());
    await render();

    const share = [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('공유하기')) as HTMLButtonElement;
    await act(async () => { share.click(); });
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });
});
