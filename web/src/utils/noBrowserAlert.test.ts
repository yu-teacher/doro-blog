import { describe, expect, it } from 'vitest';

const sources = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.*', '!/src/test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('브라우저 alert 금지', () => {
  it('화면을 멈추는 window.alert / alert() 대신 notify 를 쓴다', () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /(^|[^\w.])alert\(/m.test(text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});
