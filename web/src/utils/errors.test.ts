import axios from 'axios';
import { describe, expect, it } from 'vitest';
import { getErrorMessage, isCancelled, DEFAULT_ERROR_MESSAGE } from './errors';

describe('getErrorMessage', () => {
  it('Error 의 메시지를 쓴다 (apiClient 인터셉터가 던지는 형태)', () => {
    expect(getErrorMessage(new Error('이미 사용 중인 URL 입니다'))).toBe('이미 사용 중인 URL 입니다');
  });

  it('인터셉터를 거치지 않은 서버 오류 본문의 메시지를 우선한다', () => {
    const err = { response: { data: { error: { message: '권한이 없습니다' } } }, message: 'Request failed with status code 403' };
    expect(getErrorMessage(err)).toBe('권한이 없습니다');
  });

  it('문자열 오류도 처리한다', () => {
    expect(getErrorMessage('boom')).toBe('boom');
  });

  it.each([undefined, null, 42, {}, new Error('  ')])('메시지를 알 수 없으면(%s) 기본 문구를 쓴다', (value) => {
    expect(getErrorMessage(value)).toBe(DEFAULT_ERROR_MESSAGE);
  });

  it('호출자가 정한 기본 문구를 쓸 수 있다', () => {
    expect(getErrorMessage(null, '삭제에 실패했습니다.')).toBe('삭제에 실패했습니다.');
  });
});

describe('isCancelled', () => {
  it('axios 취소와 AbortError 를 취소로 본다', () => {
    expect(isCancelled(new axios.CanceledError('canceled'))).toBe(true);
    expect(isCancelled(new DOMException('aborted', 'AbortError'))).toBe(true);
  });

  it('일반 오류는 취소가 아니다', () => {
    expect(isCancelled(new Error('x'))).toBe(false);
    expect(isCancelled(undefined)).toBe(false);
  });
});
