import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { PageResponse, PostSummary, UserProfile } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { EditorPage } from './EditorPage';
import { clearToasts, toastMessages } from '../test/toasts';

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
    useAuthStore.setState({ isAuthenticated: true, user });
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

  it('출간 흐름: 출간하기 → 설정창이 제목/본문에서 기본값을 채움 → 출간하면 PUBLISHED 로 글을 만든다', async () => {
    const createPost = vi.spyOn(blogApi, 'createPost').mockResolvedValue({ id: 'new1' } as never);
    await render();

    typeInto(host!.querySelector('input[type="text"]') as HTMLInputElement, '출간 테스트 글');
    typeInto(textarea(), '## 소개\n![표지](https://img.test/cover.png)\n본문 내용입니다');

    const openPublish = [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '출간하기') as HTMLButtonElement;
    await act(async () => { openPublish.click(); });
    // 설정창: 본문 첫 이미지가 썸네일로, 본문 앞부분이 요약으로 채워져 있다
    expect(host!.textContent).toContain('포스트 미리보기');
    const urlInputs = [...host!.querySelectorAll('input')].map((i) => i.value);
    expect(host!.querySelector('img[src="https://img.test/cover.png"]')).not.toBeNull();
    expect(urlInputs.some((v) => v === '출간-테스트-글')).toBe(true);

    const publish = [...host!.querySelectorAll('button')].filter((b) => b.textContent?.trim() === '출간하기').pop() as HTMLButtonElement;
    await act(async () => { publish.click(); });
    await flush();

    expect(createPost).toHaveBeenCalledTimes(1);
    expect(createPost).toHaveBeenCalledWith(expect.objectContaining({
      title: '출간 테스트 글',
      status: 'PUBLISHED',
      slug: '출간-테스트-글',
      thumbnailUrl: 'https://img.test/cover.png',
    }));
  });

  it('임시 저장 버튼은 DRAFT 로 저장한다', async () => {
    const createPost = vi.spyOn(blogApi, 'createPost').mockResolvedValue({ id: 'd1' } as never);
    await render();
    typeInto(host!.querySelector('input[type="text"]') as HTMLInputElement, '초안 제목');
    typeInto(textarea(), '초안 본문');

    const save = [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '임시저장') as HTMLButtonElement;
    await act(async () => { save.click(); });
    await flush();

    expect(createPost).toHaveBeenCalledWith(expect.objectContaining({ title: '초안 제목', status: 'DRAFT' }));
  });
  it('글을 쓰는 중에 세션이 끝나도 화면을 떠나지 않고 쓰던 내용을 그대로 두며, 다시 로그인하라고 알려 준다', async () => {
    clearToasts();
    await render('/write');
    typeInto(textarea(), '쓰던 중인 본문');
    await flush();

    await act(async () => { useAuthStore.getState().markSignedOut(); });
    await flush();

    expect(textarea(), '편집기가 그대로 남아 있어야 한다').not.toBeNull();
    expect(textarea().value).toBe('쓰던 중인 본문');
    expect(toastMessages()).toEqual([]);
    expect(host!.textContent).toContain('로그인이 만료');
  });

  it('처음부터 로그인하지 않고 글쓰기 화면을 열면 안내하고 첫 화면으로 보낸다', async () => {
    clearToasts();
    useAuthStore.setState({ isAuthenticated: false, user: null });
    await render('/write');
    await flush();

    expect(toastMessages()).toContain('로그인이 필요한 서비스입니다.');
  });
});
