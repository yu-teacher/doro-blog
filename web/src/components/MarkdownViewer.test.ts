import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownViewer } from './MarkdownViewer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render(content: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MarkdownViewer, { content }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
});

describe('MarkdownViewer 코드 블록 복사', () => {
  it('문법 강조된 코드 블록의 복사 버튼은 원문 코드를 복사한다 ("[object Object]" 가 아니라)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await render('```js\nconst a = 1;\nconsole.log(a);\n```');

    const button = [...document.querySelectorAll('button')].find((b) => b.title === '코드 복사');
    expect(button, '복사 버튼').toBeDefined();
    await act(async () => {
      button!.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('const a = 1;\nconsole.log(a);');
  });

  it('인라인 코드는 복사 버튼 없이 글자로만 보인다', async () => {
    await render('문장 속의 `inline` 코드');

    expect([...document.querySelectorAll('button')].some((b) => b.title === '코드 복사')).toBe(false);
    expect(document.body.textContent).toContain('inline');
  });

  it('javascript: 링크는 렌더링되지 않는다', async () => {
    await render('[누르지 마세요](javascript:alert(1))');

    const anchors = [...document.querySelectorAll('a')];
    expect(anchors.every((a) => !(a.getAttribute('href') ?? '').toLowerCase().startsWith('javascript:'))).toBe(true);
  });
});
