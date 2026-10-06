import { describe, expect, it } from 'vitest';
import { loginErrorMessage, withoutLoginError } from './loginError';

describe('loginErrorMessage', () => {
  it('알려진 코드만 안내 문구로 바꾼다', () => {
    expect(loginErrorMessage('cancelled')).toBe('로그인이 취소되었습니다.');
    expect(loginErrorMessage('failed')).toContain('실패');
  });

  it('없거나 모르는 코드는 안내하지 않는다 (주소로 임의 문구를 화면에 넣을 수 없다)', () => {
    expect(loginErrorMessage(null)).toBeNull();
    expect(loginErrorMessage('')).toBeNull();
    expect(loginErrorMessage('<img src=x onerror=alert(1)>')).toBeNull();
    expect(loginErrorMessage('toString')).toBeNull();
    expect(loginErrorMessage('__proto__')).toBeNull();
  });
});

describe('withoutLoginError', () => {
  it('login_error 만 빼고 나머지 쿼리와 해시는 유지한다', () => {
    expect(withoutLoginError('/', '?login_error=failed', '')).toBe('/');
    expect(withoutLoginError('/search', '?q=doro&login_error=failed', '#top')).toBe('/search?q=doro#top');
  });
});
