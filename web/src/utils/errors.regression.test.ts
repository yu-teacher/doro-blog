import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './errors';

describe('[알려진 버그] 오류 메시지 우선순위', () => {
  it('인터셉터(api/client.ts)와 같은 순서로 최상위 message 를 error.message 보다 먼저 읽는다', () => {
    const err = { response: { data: { message: '최상위', error: { message: '중첩' } } } };

    expect(getErrorMessage(err)).toBe('최상위');
  });
});
