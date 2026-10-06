import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { PageResponse, PostSummary, TagItem } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { FeedPage } from './FeedPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const post = (id: string, title: string, tags: string[]) =>
  ({ id, title, slug: id, username: 'writer', nickname: '작가', summary: '요약', tags, status: 'PUBLISHED', viewCount: 0, likeCount: 0,
     commentCount: 0, createdAt: '2026-01-01T00:00:00Z', publishedAt: '2026-01-01T00:00:00Z' }) as unknown as PostSummary;

const page = (content: PostSummary[]): PageResponse<PostSummary> => ({
  content, totalElements: content.length, totalPages: 1, size: 15, number: 0, first: true, last: true, empty: content.length === 0,
});

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render(path: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MemoryRouter, { initialEntries: [path] }, createElement(FeedPage)));
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}

describe('FeedPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null });
    vi.spyOn(blogApi, 'getPopularTags').mockResolvedValue([{ id: 'g', name: 'global-tag', postCount: 40 }] as TagItem[]);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    vi.restoreAllMocks();
  });

  it('트렌딩 글과, 그 글들에 많이 쓰인 태그 순서의 태그 줄을 보여준다', async () => {
    vi.spyOn(blogApi, 'getTrendingPosts').mockResolvedValue(
      page([post('1', '스프링 글', ['spring', 'java']), post('2', '자바 글', ['java']), post('3', '또 자바', ['java'])])
    );
    await render('/?tab=trending');

    expect(host!.textContent).toContain('스프링 글');
    const text = host!.textContent ?? '';
    expect(text.indexOf('java')).toBeGreaterThan(-1);
    expect(text.indexOf('java')).toBeLessThan(text.indexOf('spring'));
    expect(text).not.toContain('global-tag');
  });

  it('글이 하나도 없으면 전체 인기 태그로 태그 줄을 채운다', async () => {
    vi.spyOn(blogApi, 'getTrendingPosts').mockResolvedValue(page([]));
    await render('/?tab=trending');

    expect(host!.textContent).toContain('global-tag');
  });

  it('비로그인 상태에서 구독 탭은 요청하지 않고, 인기 태그도 엉뚱하게 보여주지 않는다', async () => {
    const following = vi.spyOn(blogApi, 'getFollowingPosts').mockResolvedValue(page([]));
    await render('/?tab=feed');

    expect(following).not.toHaveBeenCalled();
    expect(host!.textContent).not.toContain('global-tag');
  });

  it('목록 로딩이 실패하면 서버 메시지와 다시 시도 버튼을 보여준다', async () => {
    vi.spyOn(blogApi, 'getTrendingPosts').mockRejectedValue(new Error('서버가 응답하지 않습니다.'));
    await render('/?tab=trending');

    expect(host!.textContent).toContain('서버가 응답하지 않습니다.');
    expect([...host!.querySelectorAll('button')].some((b) => b.textContent?.includes('다시 시도'))).toBe(true);
  });
});
