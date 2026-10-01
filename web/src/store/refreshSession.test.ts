import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHARED_ACCOUNTS_KEY } from '../api/tokenRefresh';
import { useAuthStore } from './authStore';

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.signature`;
}

const nowSec = () => Math.floor(Date.now() / 1000);

describe('authStore.refreshSession', () => {
  beforeEach(() => {
    localStorage.clear();
    const expiring = jwt({ email: 'a@doro.test', role: 'USER', iat: nowSec() - 840, exp: nowSec() + 60 });
    localStorage.setItem('doro_blog_token', expiring);
    localStorage.setItem('doro_blog_refresh_token', 'blog-refresh');
    useAuthStore.setState({ token: expiring, refreshToken: 'blog-refresh', isAuthenticated: true });
  });

  afterEach(() => vi.restoreAllMocks());

  it('네트워크 오류는 unavailable 이며 로그인 상태와 저장된 토큰을 유지한다', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Network Error'));

    const outcome = await useAuthStore.getState().refreshSession();

    expect(outcome.kind).toBe('unavailable');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(localStorage.getItem('doro_blog_refresh_token')).toBe('blog-refresh');
  });

  it('성공하면 게시판 저장소와 포털 공유 저장소 모두에 새 리프레시 토큰을 기록한다', async () => {
    const fresh = jwt({ email: 'a@doro.test', role: 'USER', iat: nowSec(), exp: nowSec() + 900 });
    localStorage.setItem(SHARED_ACCOUNTS_KEY, JSON.stringify([{ email: 'a@doro.test', accessToken: 'stale', refreshToken: 'blog-refresh' }]));
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { data: { accessToken: fresh, refreshToken: 'rotated' } } });

    const outcome = await useAuthStore.getState().refreshSession();

    expect(outcome.kind).toBe('refreshed');
    expect(localStorage.getItem('doro_blog_refresh_token')).toBe('rotated');
    expect(JSON.parse(localStorage.getItem(SHARED_ACCOUNTS_KEY) ?? '[]')[0]).toMatchObject({ accessToken: fresh, refreshToken: 'rotated' });
  });

  it('포털이 더 최근에 갱신해 둔 토큰이 있으면 서버를 호출하지 않고 그것을 사용한다', async () => {
    const portalToken = jwt({ email: 'a@doro.test', role: 'USER', iat: nowSec(), exp: nowSec() + 900 });
    localStorage.setItem(SHARED_ACCOUNTS_KEY, JSON.stringify([{ email: 'a@doro.test', accessToken: portalToken, refreshToken: 'portal-refresh' }]));
    const post = vi.spyOn(axios, 'post');

    const outcome = await useAuthStore.getState().refreshSession();

    expect(post).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ kind: 'refreshed', accessToken: portalToken, refreshToken: 'portal-refresh' });
    expect(localStorage.getItem('doro_blog_refresh_token')).toBe('portal-refresh');
  });

  it('서버가 거부(rejected)하면 그 결과를 돌려준다 (로그아웃 판단은 호출자 몫)', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(Object.assign(new Error('x'), {
      isAxiosError: true, response: { status: 400 },
    }));

    const outcome = await useAuthStore.getState().refreshSession();

    expect(outcome.kind).toBe('rejected');
  });
});
