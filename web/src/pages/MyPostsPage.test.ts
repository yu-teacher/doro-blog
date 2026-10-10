import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { PostSummary } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { MyPostsPage } from './MyPostsPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const post = (over: Partial<PostSummary> = {}): PostSummary =>
  ({ id: 'p1', title: '제목', slug: 's', username: 'me', status: 'DRAFT', createdAt: new Date().toISOString(), publishedAt: null,
     viewCount: 1, likeCount: 2, commentCount: 3, ...over }) as PostSummary;

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render(posts: PostSummary[]) {
  useAuthStore.setState({ isAuthenticated: true });
  vi.spyOn(blogApi, 'getMyPosts').mockResolvedValue({
    content: posts, totalElements: posts.length, totalPages: 1, size: 10, number: 0, first: true, last: true, empty: posts.length === 0,
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MemoryRouter, { initialEntries: ['/me/posts?tab=draft'] }, createElement(MyPostsPage)));
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
});

describe('MyPostsPage 모바일 레이아웃', () => {
  it('긴 제목 옆의 상태 배지는 줄어들거나 글자 단위로 줄바꿈되지 않는다', async () => {
    await render([post({ title: 'T'.repeat(70) })]);
    const badge = [...host!.querySelectorAll('span')].find((s) => s.textContent === '임시저장') as HTMLElement;
    expect(badge.className).toContain('shrink-0');
    expect(badge.className).toContain('whitespace-nowrap');
  });

  it('제목은 모바일에서 두 줄까지 보이고, 넓은 화면에서만 한 줄로 줄인다', async () => {
    await render([post({ title: '긴 제목 '.repeat(20) })]);
    const title = host!.querySelector('h3') as HTMLElement;
    expect(title.className).toContain('line-clamp-2');
    expect(title.className).toContain('sm:truncate');
    expect(title.className).toContain('min-w-0');
  });

  it('탭 줄은 좁은 화면에서 아이콘을 숨겨 네 탭이 모두 보이고, 수정·삭제 버튼은 터치용으로 커진다', async () => {
    await render([post()]);
    const icon = host!.querySelector('button svg') as SVGElement;
    expect(icon.getAttribute('class')).toContain('hidden sm:block');
    const del = host!.querySelector('button[title="글 삭제"]') as HTMLElement;
    expect(del.className).toContain('pointer-coarse:p-3');
    const edit = host!.querySelector('a[title="글 수정"]') as HTMLElement;
    expect(edit.className).toContain('pointer-coarse:p-3');
  });
});
