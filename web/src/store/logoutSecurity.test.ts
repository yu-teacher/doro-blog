import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHARED_ACCOUNTS_KEY } from '../api/tokenRefresh';
import { initAuth, useAuthStore } from './authStore';

const TOKEN_KEY = 'doro_blog_token';
const REFRESH_KEY = 'doro_blog_refresh_token';
const USER_KEY = 'doro_blog_user';
const BLOG_ACCOUNTS_KEY = 'doro_saved_accounts';

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.signature`;
}
const nowSec = () => Math.floor(Date.now() / 1000);
const validToken = (email: string) => jwt({ email, role: 'USER', iat: nowSec(), exp: nowSec() + 900, sid: 'session-1' });

function signInLocally(email: string, refresh = 'refresh-1') {
  const access = validToken(email);
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify({ id: 'u1', username: 'a', email, nickname: 'a' }));
  localStorage.setItem(BLOG_ACCOUNTS_KEY, JSON.stringify([{ userId: 'u1', email, name: 'A', accessToken: access, refreshToken: refresh }]));
  localStorage.setItem(SHARED_ACCOUNTS_KEY, JSON.stringify([{ email, userId: 'u1', fullName: 'A', accessToken: access, refreshToken: refresh }]));
  useAuthStore.setState({ token: access, refreshToken: refresh, isAuthenticated: true, user: { id: 'u1', username: 'a', email, nickname: 'a' } as never });
  return access;
}

describe('로그아웃 보안', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('로그아웃하면 저장된 계정(게시판·포털 공유)의 토큰도 지워지고, 계정 정보는 남는다', () => {
    signInLocally('a@doro.test');

    useAuthStore.getState().logout();

    const blog = JSON.parse(localStorage.getItem(BLOG_ACCOUNTS_KEY) ?? '[]');
    const shared = JSON.parse(localStorage.getItem(SHARED_ACCOUNTS_KEY) ?? '[]');
    expect(blog[0]).toMatchObject({ email: 'a@doro.test', name: 'A' });
    expect(blog[0].accessToken).toBeUndefined();
    expect(blog[0].refreshToken).toBeUndefined();
    expect(shared[0]).toMatchObject({ email: 'a@doro.test', fullName: 'A' });
    expect(shared[0].accessToken).toBeUndefined();
    expect(shared[0].refreshToken).toBeUndefined();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('다른 계정의 저장 토큰은 건드리지 않는다', () => {
    signInLocally('a@doro.test');
    const raw = JSON.parse(localStorage.getItem(BLOG_ACCOUNTS_KEY) ?? '[]');
    raw.push({ userId: 'u2', email: 'b@doro.test', name: 'B', accessToken: 'b-at', refreshToken: 'b-rt' });
    localStorage.setItem(BLOG_ACCOUNTS_KEY, JSON.stringify(raw));

    useAuthStore.getState().logout();

    const blog = JSON.parse(localStorage.getItem(BLOG_ACCOUNTS_KEY) ?? '[]');
    expect(blog.find((a: { email: string }) => a.email === 'b@doro.test')).toMatchObject({ accessToken: 'b-at', refreshToken: 'b-rt' });
  });

  it('직접 로그아웃(signOut)은 서버 세션 종료를 요청하고 로컬 상태를 비운다', async () => {
    const access = signInLocally('a@doro.test');
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { success: true } });

    await useAuthStore.getState().signOut();

    expect(post).toHaveBeenCalledWith('/iam/api/v1/auth/logout', null, expect.objectContaining({
      headers: { Authorization: `Bearer ${access}` },
    }));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('서버 종료 요청이 실패해도 로컬 로그아웃은 유지된다', async () => {
    signInLocally('a@doro.test');
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Network Error'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(useAuthStore.getState().signOut()).resolves.toBeUndefined();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe('멀티탭 로그아웃', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** 다른 탭이 저장소를 바꿨을 때 이 탭이 받는 이벤트를 흉내 낸다. */
  const otherTabChanged = (key: string | null) => window.dispatchEvent(new StorageEvent('storage', { key }));

  it('다른 탭이 로그아웃하면 이 탭도 로그아웃되고, 저장소에 토큰을 다시 쓰지 않는다', () => {
    signInLocally('a@doro.test');
    initAuth();

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    otherTabChanged(TOKEN_KEY);

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('저장소에 리프레시 토큰이 없으면 메모리에 남은 값으로 갱신해 로그인을 되살리지 않는다', async () => {
    signInLocally('a@doro.test');
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    const post = vi.spyOn(axios, 'post');

    const outcome = await useAuthStore.getState().refreshSession();

    expect(outcome.kind).toBe('rejected');
    expect(post).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('다른 탭이 로그인하거나 갱신하면 이 탭도 그 토큰으로 바뀐다', () => {
    useAuthStore.setState({ token: null, refreshToken: null, isAuthenticated: false, user: null });
    initAuth();

    const access = signInLocally('a@doro.test', 'refresh-from-other-tab');
    useAuthStore.setState({ token: null, refreshToken: null, isAuthenticated: false, user: null }); // 이 탭은 아직 모름
    otherTabChanged(TOKEN_KEY);

    expect(useAuthStore.getState()).toMatchObject({ token: access, refreshToken: 'refresh-from-other-tab', isAuthenticated: true });
  });
});
