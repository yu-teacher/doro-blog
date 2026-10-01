import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSavedAccounts, removeSavedAccount, saveAccountHistory } from './savedAccounts';

const BLOG_KEY = 'doro_saved_accounts';
const PORTAL_KEY = 'doro_auth_accounts';

describe('savedAccounts', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('저장소가 비어 있으면 빈 목록', () => {
    expect(getSavedAccounts()).toEqual([]);
  });

  it('새 계정은 맨 앞에 추가되고, 같은 이메일(대소문자 무시)은 합쳐서 갱신한다', () => {
    saveAccountHistory({ email: 'a@doro.test', name: 'A', userId: 'u1', accessToken: 'at1' });
    vi.advanceTimersByTime(1000);
    saveAccountHistory({ email: 'B@doro.test', name: 'B', userId: 'u2' });
    vi.advanceTimersByTime(1000);
    saveAccountHistory({ email: 'A@doro.test', refreshToken: 'rt1' });

    const list = getSavedAccounts();
    expect(list).toHaveLength(2);
    const a = list.find((x) => x.email.toLowerCase() === 'a@doro.test')!;
    expect(a).toMatchObject({ userId: 'u1', name: 'A', accessToken: 'at1', refreshToken: 'rt1' });
    expect(list[0]!.email.toLowerCase()).toBe('a@doro.test'); // 가장 최근에 사용한 계정이 먼저
  });

  it('포털이 저장한 계정과 합치되, 게시판에만 있는 정보(닉네임)는 유지한다', () => {
    localStorage.setItem(BLOG_KEY, JSON.stringify([{ userId: 'u1', email: 'a@doro.test', name: 'old', nickname: '닉', lastUsedAt: 5 }]));
    localStorage.setItem(PORTAL_KEY, JSON.stringify([
      { email: 'a@doro.test', userId: 'u1', fullName: '포털이름', accessToken: 'portal-at', refreshToken: 'portal-rt' },
      { email: 'c@doro.test', userId: 'u3', name: 'C' },
    ]));

    const list = getSavedAccounts();
    const a = list.find((x) => x.email === 'a@doro.test')!;
    expect(a).toMatchObject({ name: '포털이름', nickname: '닉', accessToken: 'portal-at', refreshToken: 'portal-rt' });
    expect(list.map((x) => x.email).sort()).toEqual(['a@doro.test', 'c@doro.test']);
  });

  it('손상된 저장 값은 무시한다', () => {
    localStorage.setItem(BLOG_KEY, '{not json');
    localStorage.setItem(PORTAL_KEY, '"string"');
    expect(getSavedAccounts()).toEqual([]);
  });

  it('removeSavedAccount 는 이메일(대소문자 무시)로 게시판 저장소에서 지운다', () => {
    saveAccountHistory({ email: 'a@doro.test', name: 'A' });
    saveAccountHistory({ email: 'b@doro.test', name: 'B' });
    removeSavedAccount('A@DORO.test');
    expect(getSavedAccounts().map((x) => x.email)).toEqual(['b@doro.test']);
  });
});
