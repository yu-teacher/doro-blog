import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CSRF_HEADER, CSRF_VALUE } from '../api/csrf';
import type { UserProfile } from '../api/types';
import { buildLoginUrl, purgeLegacyLoginStorage, useAuthStore } from './authStore';

const user: UserProfile = {
  id: 'u1', username: 'tester', email: 't@doro.test', nickname: '테스터', blogTitle: 'tester.log',
  followerCount: 0, followingCount: 0, createdAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  useAuthStore.setState({ user: null, role: null, isAuthenticated: false, isAdmin: false });
});
afterEach(() => vi.restoreAllMocks());

describe('buildLoginUrl', () => {
  it('돌아올 경로를 인코딩해서 로그인 시작 주소에 싣는다', () => {
    expect(buildLoginUrl('/@alice/my-post?x=1&y=2')).toBe('/api/v1/bff/login?return=%2F%40alice%2Fmy-post%3Fx%3D1%26y%3D2');
  });
});

describe('loadSession', () => {
  it('서버가 로그인 상태라고 알려 주면 사용자와 역할을 반영한다', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: { data: { authenticated: true, user, role: 'USER' } } });

    await useAuthStore.getState().loadSession();

    expect(get).toHaveBeenCalledWith('/api/v1/bff/session', { headers: { [CSRF_HEADER]: CSRF_VALUE } });
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, user, role: 'USER', isAdmin: false });
  });

  it('관리자 역할이면 isAdmin 이 true 다', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({ data: { data: { authenticated: true, user, role: 'ADMIN' } } });

    await useAuthStore.getState().loadSession();

    expect(useAuthStore.getState().isAdmin).toBe(true);
  });

  it('비로그인이거나 서버에 닿지 못해도 오류 없이 비로그인 상태가 된다', async () => {
    useAuthStore.setState({ user, isAuthenticated: true });
    vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: { data: { authenticated: false, user: null } } });
    await useAuthStore.getState().loadSession();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    useAuthStore.setState({ user, isAuthenticated: true });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(axios, 'get').mockRejectedValueOnce(new Error('Network Error'));
    await useAuthStore.getState().loadSession();
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, user: null });
  });
});

describe('signOut', () => {
  it('서버에 로그아웃을 요청하고(CSRF 헤더 포함) 화면 상태를 비운다', async () => {
    useAuthStore.setState({ user, isAuthenticated: true });
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });

    await useAuthStore.getState().signOut();

    expect(post).toHaveBeenCalledWith('/api/v1/bff/logout', null, { headers: { [CSRF_HEADER]: CSRF_VALUE } });
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, user: null });
  });

  it('서버 요청이 실패해도 화면은 로그아웃 상태가 된다', async () => {
    useAuthStore.setState({ user, isAuthenticated: true });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Network Error'));

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('토큰을 브라우저에 두지 않는다', () => {
  it('로그인 상태가 되어도 localStorage 에 토큰이나 계정 정보를 쓰지 않는다', async () => {
    localStorage.clear();
    vi.spyOn(axios, 'get').mockResolvedValue({ data: { data: { authenticated: true, user, role: 'USER' } } });

    await useAuthStore.getState().loadSession();

    expect(localStorage.length).toBe(0);
  });
});

describe('purgeLegacyLoginStorage', () => {
  it('이전 로그인 방식이 남긴 토큰과 저장 계정을 지우고, 포털과 공유하는 키와 다른 값은 건드리지 않는다', () => {
    localStorage.setItem('doro_blog_token', 'old-access');
    localStorage.setItem('doro_blog_refresh_token', 'old-refresh');
    localStorage.setItem('doro_blog_user', '{}');
    localStorage.setItem('doro_saved_accounts', '[]');
    localStorage.setItem('doro_auth_accounts', '[{"email":"portal@doro.test"}]');
    localStorage.setItem('theme', 'dark');

    purgeLegacyLoginStorage();

    expect(localStorage.getItem('doro_blog_token')).toBeNull();
    expect(localStorage.getItem('doro_blog_refresh_token')).toBeNull();
    expect(localStorage.getItem('doro_blog_user')).toBeNull();
    expect(localStorage.getItem('doro_saved_accounts')).toBeNull();
    expect(localStorage.getItem('doro_auth_accounts')).not.toBeNull();
    expect(localStorage.getItem('theme')).toBe('dark');
    localStorage.clear();
  });
});
