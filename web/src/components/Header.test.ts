import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { UserProfile } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { Header } from './Header';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user: UserProfile = {
  id: 'u1', username: 'tester', email: 't@doro.test', nickname: '테스터', blogTitle: 'tester.log',
  followerCount: 0, followingCount: 0, createdAt: '2026-01-01T00:00:00Z',
};

let root: Root | undefined;
let host: HTMLElement | undefined;
let lastLocation = '';

function LocationProbe() {
  const loc = useLocation();
  lastLocation = loc.pathname + loc.search;
  return null;
}

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MemoryRouter, { initialEntries: ['/'] },
      createElement(Header), createElement(Routes, null, createElement(Route, { path: '*', element: createElement(LocationProbe) }))));
  });
}

const button = (title: string) => host!.querySelector(`button[title="${title}"]`) as HTMLButtonElement;

function typeInto(el: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Header', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, isAdmin: false, user: null, token: null, refreshToken: null, loginModalOpen: false });
    vi.spyOn(blogApi, 'getPopularTags').mockResolvedValue([
      { id: '1', name: 'spring', postCount: 4 }, { id: '2', name: 'react', postCount: 2 },
    ] as never);
    vi.spyOn(blogApi, 'getUnreadNotificationCount').mockResolvedValue(0);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    vi.restoreAllMocks();
  });

  it('비로그인이면 로그인/회원가입 버튼이 있고, 로그인 버튼이 로그인 모달을 연다', async () => {
    await render();
    const login = [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '로그인') as HTMLButtonElement;
    expect(login).toBeDefined();
    act(() => login.click());
    expect(useAuthStore.getState().loginModalOpen).toBe(true);
  });

  it('검색창: 열면 입력이 나오고, #태그 입력 시 추천 태그가 보이며, 제출하면 해당 주소로 이동한다', async () => {
    await render();
    await act(async () => { button('검색').click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const input = host!.querySelector('input[placeholder^="검색어"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    typeInto(input, '#spr');
    expect(host!.textContent).toContain('추천 태그');
    expect(host!.textContent).toContain('spring');
    expect(host!.textContent).not.toContain('react');

    await act(async () => {
      (input.closest('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(lastLocation).toBe('/tags?tag=spr');
    expect(host!.querySelector('input[placeholder^="검색어"]')).toBeNull();
  });

  it('본문 검색은 /search 로 이동한다', async () => {
    await render();
    await act(async () => { button('검색').click(); });
    typeInto(host!.querySelector('input[placeholder^="검색어"]') as HTMLInputElement, 'docker 입문');
    await act(async () => {
      (host!.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(lastLocation).toBe(`/search?q=${encodeURIComponent('docker 입문')}`);
  });

  it('로그인 상태에서는 글쓰기 링크와 사용자 메뉴가 있고, 메뉴에서 로그아웃할 수 있다', async () => {
    const logout = vi.fn();
    useAuthStore.setState({ isAuthenticated: true, user, logout });
    await render();
    expect(host!.querySelector('a[href="/write"]')).not.toBeNull();

    const toggle = [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '테') as HTMLButtonElement;
    expect(toggle).not.toBeNull();
    act(() => toggle.click());
    expect(host!.textContent).toContain('로그아웃');

    const out = [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('로그아웃')) as HTMLButtonElement;
    act(() => out.click());
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
