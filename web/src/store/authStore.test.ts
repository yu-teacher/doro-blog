import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserRole, isTokenExpired } from '../utils/jwt';
import { initAuth, useAuthStore } from './authStore';

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.signature`;
}

const nowSec = () => Math.floor(Date.now() / 1000);

describe('토큰 판별', () => {
  it('exp 가 지났거나 5초 이내면 만료로 본다', () => {
    expect(isTokenExpired(jwt({ exp: nowSec() - 1 }))).toBe(true);
    expect(isTokenExpired(jwt({ exp: nowSec() + 3 }))).toBe(true);
    expect(isTokenExpired(jwt({ exp: nowSec() + 600 }))).toBe(false);
  });

  it('읽을 수 없는 토큰은 만료, exp 가 없는 토큰은 만료가 아니다', () => {
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired('garbage')).toBe(true);
    expect(isTokenExpired(jwt({ sub: 'u1' }))).toBe(false);
  });

  it('역할은 문자열일 때만 돌려준다', () => {
    expect(getUserRole(jwt({ role: 'ADMIN' }))).toBe('ADMIN');
    expect(getUserRole(jwt({ role: 5 }))).toBeNull();
    expect(getUserRole(jwt({}))).toBeNull();
    expect(getUserRole(null)).toBeNull();
  });
});

describe('initAuth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    useAuthStore.getState().logout();
  });

  it('유효한 토큰이면 서버를 호출하지 않고 만료 전에 자동 갱신을 예약한다', async () => {
    const token = jwt({ role: 'USER', exp: nowSec() + 900 });
    useAuthStore.setState({ token, refreshToken: 'r', isAuthenticated: true });
    const refresh = vi.spyOn(useAuthStore.getState(), 'refreshSession').mockResolvedValue({ kind: 'unavailable' });
    useAuthStore.setState({ refreshSession: refresh });

    initAuth();
    expect(refresh).not.toHaveBeenCalled();

    // 수명 900초(>10분) → 만료 5분 전, 즉 600초 뒤에 갱신한다
    await vi.advanceTimersByTimeAsync(599_000);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('액세스 토큰이 만료되었고 리프레시 토큰이 있으면 즉시 조용히 갱신한다', async () => {
    useAuthStore.setState({ token: null, refreshToken: 'r', isAuthenticated: true });
    const refresh = vi.fn().mockResolvedValue({ kind: 'unavailable' });
    useAuthStore.setState({ refreshSession: refresh });

    initAuth();
    await vi.advanceTimersByTimeAsync(0);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('토큰이 아무것도 없으면 아무것도 하지 않는다', async () => {
    useAuthStore.setState({ token: null, refreshToken: null, isAuthenticated: false });
    const refresh = vi.fn();
    useAuthStore.setState({ refreshSession: refresh });

    initAuth();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(refresh).not.toHaveBeenCalled();
  });
});
