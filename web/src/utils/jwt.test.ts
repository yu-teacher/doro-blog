import { describe, expect, it } from 'vitest';
import { decodeJwtPayload } from './jwt';

function token(payload: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${btoa('{"alg":"RS256"}')}.${b64}.sig`;
}

describe('decodeJwtPayload', () => {
  it('URL-safe base64 와 패딩 없는 페이로드를 읽는다', () => {
    expect(decodeJwtPayload(token({ sub: 'u1', role: 'USER', exp: 123 }))).toMatchObject({ sub: 'u1', role: 'USER', exp: 123 });
  });

  it('한글 등 멀티바이트 문자를 깨뜨리지 않는다', () => {
    expect(decodeJwtPayload(token({ name: '홍길동' }))?.name).toBe('홍길동');
  });

  it.each([null, undefined, '', 'abc', 'a.b', 'a.!!!.c'])('읽을 수 없는 토큰(%s)은 null', (value) => {
    expect(decodeJwtPayload(value)).toBeNull();
  });

  it('객체가 아닌 페이로드는 null', () => {
    const arr = `${btoa('{}')}.${btoa('[1,2]')}.s`;
    expect(decodeJwtPayload(arr)).toBeNull();
  });
});
