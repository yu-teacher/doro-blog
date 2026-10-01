import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { PageResponse, PostSummary, UserProfile } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { EditorPage } from './EditorPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const emptyPage: PageResponse<PostSummary> = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 10,
  number: 0,
  first: true,
  last: true,
  empty: true,
};

const user: UserProfile = {
  id: 'u1',
  username: 'tester',
  email: 't@doro.test',
  nickname: 'tester',
  blogTitle: 'tester.log',
  followerCount: 0,
  followingCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
};

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render(path = '/write') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      createElement(MemoryRouter, { initialEntries: [path] }, createElement(Routes, null,
        createElement(Route, { path: '/write', element: createElement(EditorPage) }),
        createElement(Route, { path: '/edit/:id', element: createElement(EditorPage) })))
    );
  });
}

const textarea = () => host!.querySelector('textarea') as HTMLTextAreaElement;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

function typeInto(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  act(() => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('EditorPage (분리된 훅/컴포넌트 연결)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: true, user, token: null, refreshToken: null });
    vi.spyOn(blogApi, 'getMyPosts').mockResolvedValue(emptyPage);
    vi.spyOn(blogApi, 'getUserSeries').mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    vi.restoreAllMocks();
  });

  it('새 글 화면이 렌더되고, 입력하면 미리보기에 반영된다', async () => {
    await render();
    expect(textarea()).not.toBeNull();

    const titleInput = host!.querySelector('input[type="text"]') as HTMLInputElement;
    typeInto(titleInput, '테스트 제목');
    typeInto(textarea(), '본문 내용');

    expect(host!.textContent).toContain('테스트 제목');
    expect(host!.textContent).toContain('본문 내용');
  });

  it('툴바의 굵게 버튼이 선택 영역을 감싼다', async () => {
    await render();
    typeInto(textarea(), 'hello');
    act(() => textarea().setSelectionRange(0, 5));

    const bold = host!.querySelector('button[title="굵게 (Bold)"]') as HTMLButtonElement;
    act(() => bold.click());

    expect(textarea().value).toBe('**hello**');
  });

  it('로컬에 백업된 글이 있으면 복원 배너가 보이고 복원하면 내용이 채워진다', async () => {
    localStorage.setItem('doro_editor_draft_tester', JSON.stringify({ title: '백업 제목', content: '백업 본문', tags: ['a'], summary: '', thumbnailUrl: '' }));
    await render();
    expect(host!.textContent).toContain('임시 저장본');

    const restore = [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '불러오기') as HTMLButtonElement | undefined;
    expect(restore).toBeDefined();
    act(() => restore!.click());

    expect(textarea().value).toBe('백업 본문');
    expect(host!.textContent).not.toContain('임시 저장본이 있습니다');
  });

  it('기존 글 수정 화면은 서버에서 불러온 본문으로 채워진다', async () => {
    vi.spyOn(blogApi, 'getPostById').mockResolvedValue({
      post: { id: 'p1', title: '기존 제목', slug: 's', summary: '', thumbnailUrl: null, status: 'DRAFT', tags: [], seriesId: null } as unknown as PostSummary,
      content: '서버 본문',
      likedByMe: false,
      author: null,
    } as never);
    await render('/edit/p1');
    await flush();

    expect(textarea().value).toBe('서버 본문');
  });
});
