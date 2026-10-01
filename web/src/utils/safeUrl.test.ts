import { describe, expect, it } from 'vitest';
import { safeHttpUrl } from './safeUrl';

describe('safeHttpUrl', () => {
  it.each(['https://github.com/doro', 'http://example.com/a?b=c#d', '  https://example.com  '])('http(s) 주소(%s)는 통과한다', (value) => {
    expect(safeHttpUrl(value)).toBeTruthy();
  });

  it.each([
    'javascript:alert(document.cookie)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.example/x',
    'example.com',
    '',
    null,
    undefined,
  ])('위험하거나 잘못된 값(%s)은 undefined 를 돌려준다', (value) => {
    expect(safeHttpUrl(value as string | null | undefined)).toBeUndefined();
  });
});
