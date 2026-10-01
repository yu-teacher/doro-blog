import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TagInput, addTag } from './TagInput';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('addTag', () => {
  it('앞의 # 와 공백을 정리하고, 빈 값/중복은 무시한다', () => {
    expect(addTag(['a'], '  #spring ')).toEqual(['a', 'spring']);
    expect(addTag(['a'], 'a')).toEqual(['a']);
    expect(addTag(['a'], '   ')).toEqual(['a']);
    expect(addTag([], '#')).toEqual([]);
  });
});

describe('TagInput', () => {
  let root: Root | undefined;
  let host: HTMLElement | undefined;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
  });

  function render(tags: string[], onChange: (t: string[]) => void) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(createElement(TagInput, { tags, onChange })));
  }

  const input = () => host!.querySelector('input') as HTMLInputElement;
  const type = (value: string) => act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
  const key = (k: string, composing = false) => act(() => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    Object.defineProperty(e, 'isComposing', { value: composing });
    input().dispatchEvent(e);
  });

  it('Enter 로 태그를 추가하고 입력창을 비운다', () => {
    const onChange = vi.fn();
    render(['a'], onChange);
    type('#b');
    key('Enter');
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
    expect(input().value).toBe('');
  });

  it('한글 조합 입력 중의 Enter 는 무시한다', () => {
    const onChange = vi.fn();
    render([], onChange);
    type('스프링');
    key('Enter', true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('입력이 비어 있을 때 Backspace 는 마지막 태그를 지우고, 태그를 누르면 그 태그가 삭제된다', () => {
    const onChange = vi.fn();
    render(['a', 'b'], onChange);
    key('Backspace');
    expect(onChange).toHaveBeenLastCalledWith(['a']);

    const chip = [...host!.querySelectorAll('span')].find((s) => s.textContent?.includes('#a')) as HTMLElement;
    act(() => chip.click());
    expect(onChange).toHaveBeenLastCalledWith(['b']);
  });
});
