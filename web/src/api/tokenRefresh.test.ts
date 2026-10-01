import axios, { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SHARED_ACCOUNTS_KEY,
  emailOfToken,
  findFresherSharedTokens,
  requestTokenRefresh,
  writeBackSharedTokens,
} from './tokenRefresh';

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.signature`;
}

const nowSec = () => Math.floor(Date.now() / 1000);

function httpError(status: number): AxiosError {
  return new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status, statusText: '', data: {}, headers: {}, config: { headers: {} } as never,
  });
}

describe('requestTokenRefresh', () => {
  afterEach(() => vi.restoreAllMocks());

  it('성공하면 새 토큰 쌍을 돌려준다', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { data: { accessToken: 'a2', refreshToken: 'r2' } } });

    expect(await requestTokenRefresh('r1')).toEqual({ kind: 'refreshed', accessToken: 'a2', refreshToken: 'r2' });
  });

  it('응답에 새 리프레시 토큰이 없으면 기존 값을 유지한다', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { data: { accessToken: 'a2' } } });

    expect(await requestTokenRefresh('r1')).toEqual({ kind: 'refreshed', accessToken: 'a2', refreshToken: 'r1' });
  });

  it.each([400, 401, 403])('서버가 거부(%i)하면 rejected', async (status) => {
    vi.spyOn(axios, 'post').mockRejectedValue(httpError(status));

    expect(await requestTokenRefresh('r1')).toEqual({ kind: 'rejected' });
  });

  it('네트워크 오류와 5xx 는 unavailable (로그아웃 사유가 아님)', async () => {
    const post = vi.spyOn(axios, 'post');
    post.mockRejectedValueOnce(new Error('Network Error'));
    post.mockRejectedValueOnce(httpError(502));

    expect(await requestTokenRefresh('r1')).toEqual({ kind: 'unavailable' });
    expect(await requestTokenRefresh('r1')).toEqual({ kind: 'unavailable' });
  });
});

describe('공유 계정 저장소(포털)와의 토큰 동기화', () => {
  beforeEach(() => localStorage.clear());

  it('토큰 payload 에서 이메일을 소문자로 꺼낸다', () => {
    expect(emailOfToken(jwt({ email: 'User@Doro.Test' }))).toBe('user@doro.test');
    expect(emailOfToken('not-a-jwt')).toBeNull();
  });

  it('포털이 더 최근에 발급받은 유효한 토큰이 있으면 그것을 돌려준다', () => {
    const own = jwt({ email: 'a@doro.test', iat: nowSec() - 600, exp: nowSec() + 300 });
    const portal = jwt({ email: 'a@doro.test', iat: nowSec() - 10, exp: nowSec() + 890 });
    localStorage.setItem(SHARED_ACCOUNTS_KEY, JSON.stringify([{ email: 'A@doro.test', accessToken: portal, refreshToken: 'portal-r' }]));

    expect(findFresherSharedTokens('a@doro.test', own)).toEqual({ accessToken: portal, refreshToken: 'portal-r' });
  });

  it('포털 토큰이 더 오래됐거나 만료됐으면 사용하지 않는다', () => {
    const own = jwt({ email: 'a@doro.test', iat: nowSec() - 10, exp: nowSec() + 890 });
    const older = jwt({ email: 'a@doro.test', iat: nowSec() - 600, exp: nowSec() + 300 });
    const expired = jwt({ email: 'a@doro.test', iat: nowSec() + 1, exp: nowSec() - 1 });

    localStorage.setItem(SHARED_ACCOUNTS_KEY, JSON.stringify([{ email: 'a@doro.test', accessToken: older, refreshToken: 'r' }]));
    expect(findFresherSharedTokens('a@doro.test', own)).toBeNull();

    localStorage.setItem(SHARED_ACCOUNTS_KEY, JSON.stringify([{ email: 'a@doro.test', accessToken: expired, refreshToken: 'r' }]));
    expect(findFresherSharedTokens('a@doro.test', own)).toBeNull();
  });

  it('다른 계정의 토큰이나 손상된 저장소는 무시한다', () => {
    const own = jwt({ email: 'a@doro.test', iat: 1, exp: nowSec() + 100 });
    const other = jwt({ email: 'b@doro.test', iat: nowSec(), exp: nowSec() + 900 });
    localStorage.setItem(SHARED_ACCOUNTS_KEY, JSON.stringify([{ email: 'b@doro.test', accessToken: other, refreshToken: 'r' }]));
    expect(findFresherSharedTokens('a@doro.test', own)).toBeNull();

    localStorage.setItem(SHARED_ACCOUNTS_KEY, '{broken');
    expect(findFresherSharedTokens('a@doro.test', own)).toBeNull();
  });

  it('갱신 결과를 해당 이메일의 공유 계정에만 되돌려 쓴다', () => {
    localStorage.setItem(SHARED_ACCOUNTS_KEY, JSON.stringify([
      { email: 'a@doro.test', accessToken: 'old-a', refreshToken: 'old-ra', fullName: 'A' },
      { email: 'b@doro.test', accessToken: 'old-b', refreshToken: 'old-rb' },
    ]));

    writeBackSharedTokens('a@doro.test', 'new-a', 'new-ra');

    const stored = JSON.parse(localStorage.getItem(SHARED_ACCOUNTS_KEY) ?? '[]');
    expect(stored[0]).toMatchObject({ accessToken: 'new-a', refreshToken: 'new-ra', fullName: 'A' });
    expect(stored[1]).toMatchObject({ accessToken: 'old-b', refreshToken: 'old-rb' });
  });
});
