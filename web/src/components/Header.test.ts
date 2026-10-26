import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { UserProfile } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { DEV_ACCOUNT_PATH, DEV_HOME_PATH, DEV_LOGS_PATH } from '../utils/portalLinks';
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
    useAuthStore.setState({ isAuthenticated: false, isAdmin: false, user: null });
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

  it('비로그인이면 로그인 버튼이 있고, 누르면 Doro 로그인을 시작한다', async () => {
    const login = vi.fn();
    useAuthStore.setState({ login });
    await render();
    const button = [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '로그인') as HTMLButtonElement;
    expect(button).toBeDefined();
    act(() => button.click());
    expect(login).toHaveBeenCalledTimes(1);
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
    const signOut = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ isAuthenticated: true, user, signOut });
    await render();
    expect(host!.querySelector('a[href="/write"]')).not.toBeNull();

    const toggle = [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '테') as HTMLButtonElement;
    expect(toggle).not.toBeNull();
    act(() => toggle.click());
    expect(host!.textContent).toContain('로그아웃');

    const out = [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('로그아웃')) as HTMLButtonElement;
    act(() => out.click());
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  describe('모바일 헤더 구성', () => {
    const signedIn = () => useAuthStore.setState({ isAuthenticated: true, isAdmin: false, user });
    const openUserMenu = async () => {
      const toggle = [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '테' ) as HTMLButtonElement;
      await act(async () => { toggle.click(); });
    };

    it('로그인하면 헤더에 "새 글 작성" 아이콘이 있다 (모바일에서 글쓰기를 시작할 입구)', async () => {
      signedIn();
      await render();

      const write = host!.querySelector('a[aria-label="새 글 작성"]') as HTMLAnchorElement;
      expect(write).not.toBeNull();
      expect(write.getAttribute('href')).toBe('/write');
      expect(write.className).toContain('sm:hidden'); // 넓은 화면에는 글자 버튼이 따로 있다
    });

    it('비로그인에는 글쓰기 아이콘이 없다', async () => {
      await render();
      expect(host!.querySelector('a[aria-label="새 글 작성"]')).toBeNull();
    });

    it('서비스 바로가기(앱 런처)는 모든 너비에서 보인다(숨기는 래퍼가 없다)', async () => {
      await render();

      const launcher = host!.querySelector('button[aria-label^="Doro Dev 바로가기"]') as HTMLButtonElement;
      expect(launcher).not.toBeNull();
      expect(launcher.closest('div.hidden'), '런처를 감싼 요소가 숨겨지면 안 된다').toBeNull();
    });

    it('사용자 메뉴에는 일반 서비스(허브) 링크가 없고 계정 링크는 Doro Dev 경로다', async () => {
      signedIn();
      await render();
      await openUserMenu();

      const hrefs = [...host!.querySelectorAll('a')].map((a) => a.getAttribute('href'));
      expect(hrefs).toContain(DEV_ACCOUNT_PATH);
      expect(host!.textContent).not.toContain('서비스 전체 보기');
    });

    it('헤더의 그리드 버튼은 앱 런처 하나뿐이다(별도 허브 링크 아이콘이 없다)', async () => {
      await render();
      expect(host!.querySelector('a[aria-label="DORO 서비스 전체 보기"]')).toBeNull();
      expect(host!.querySelectorAll('button[aria-label^="Doro Dev 바로가기"]').length).toBe(1);
    });

    it('앱 런처는 Doro Dev 홈·계정(/dev/ 경로)으로 가는 일반 링크이고 일반 서비스는 드러내지 않는다', async () => {
      await render();
      const launcher = host!.querySelector('button[aria-label^="Doro Dev 바로가기"]') as HTMLButtonElement;
      await act(async () => { launcher.click(); });

      const links = [...host!.querySelectorAll('a')];
      const home = links.find((a) => a.textContent?.includes('Doro Dev 홈')) as HTMLAnchorElement;
      expect(home.getAttribute('href')).toBe(DEV_HOME_PATH);
      const account = links.find((a) => a.textContent?.includes('Doro 계정')) as HTMLAnchorElement;
      expect(account.getAttribute('href')).toBe(DEV_ACCOUNT_PATH);
      expect(links.some((a) => a.getAttribute('href') === DEV_LOGS_PATH)).toBe(false); // 관리자 전용
      expect(host!.textContent).not.toMatch(/파티|게임|메뉴|통합|모든 서비스/);
    });

    it('관리자에게만 앱 런처에 관제 로그(/dev/logs)가 보인다', async () => {
      signedIn();
      useAuthStore.setState({ isAdmin: true });
      await render();
      const launcher = host!.querySelector('button[aria-label^="Doro Dev 바로가기"]') as HTMLButtonElement;
      await act(async () => { launcher.click(); });

      const logs = [...host!.querySelectorAll('a')].find((a) => a.textContent?.includes('관제 로그')) as HTMLAnchorElement;
      expect(logs.getAttribute('href')).toBe(DEV_LOGS_PATH);
    });

    it('로그인한 모바일에서는 테마 전환을 사용자 메뉴에서 한다 (헤더 버튼은 넓은 화면 전용)', async () => {
      signedIn();
      await render();

      const headerToggle = host!.querySelector('header button[aria-label$="모드로 전환"]') as HTMLButtonElement;
      expect(headerToggle.className).toContain('hidden');
      expect(headerToggle.className).toContain('sm:block');

      await openUserMenu();
      const menuToggle = [...host!.querySelectorAll('button')].find((b) => b.className.includes('sm:hidden') && b.textContent?.includes('모드로 전환')) as HTMLButtonElement;
      expect(menuToggle).toBeDefined();
      const before = document.documentElement.classList.contains('dark');
      await act(async () => { menuToggle.click(); });
      expect(document.documentElement.classList.contains('dark')).toBe(!before);
    });

    it('비로그인에서는 테마 전환 버튼이 모바일 헤더에도 보인다', async () => {
      await render();
      const headerToggle = host!.querySelector('header button[aria-label$="모드로 전환"]') as HTMLButtonElement;
      expect(headerToggle.className).not.toContain('hidden');
    });
  });
});
