import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { nodeText } from './reactText';

describe('React 노드에서 글자만 꺼내기', () => {
  it('문자열과 숫자는 그대로 이어 붙인다', () => {
    expect(nodeText('abc')).toBe('abc');
    expect(nodeText(['a', 1, 'b'])).toBe('a1b');
  });

  it('하이라이트된 코드처럼 span 으로 감싼 자식도 안쪽 글자까지 이어 붙인다 ([object Object] 가 되면 안 된다)', () => {
    const children = ['const ', createElement('span', { className: 'hljs-keyword' }, 'a'), ' = ', createElement('span', null, ['1', createElement('b', null, '0')]), ';\n'];

    expect(nodeText(children)).toBe('const a = 10;\n');
  });

  it('null, undefined, boolean 은 빈 글자', () => {
    expect(nodeText([null, undefined, false, true, 'x'])).toBe('x');
    expect(nodeText(undefined)).toBe('');
  });
});
