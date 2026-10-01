import { act, createElement, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useMarkdownEditor, type MarkdownEditor } from './useMarkdownEditor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Harness {
  editor: () => MarkdownEditor;
  value: () => string;
  textarea: () => HTMLTextAreaElement;
  select: (start: number, end?: number) => void;
  type: (text: string) => void;
  unmount: () => void;
}

function mount(initial: string): Harness {
  let editor!: MarkdownEditor;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);

  function Probe() {
    const [content, setContent] = useState(initial);
    const ref = useRef<HTMLTextAreaElement>(null);
    editor = useMarkdownEditor({ content, setContent, textareaRef: ref, resetKey: null });
    return createElement('textarea', { ref, value: content, onChange: editor.handleContentChange });
  }
  act(() => root.render(createElement(Probe)));

  const textarea = () => host.querySelector('textarea') as HTMLTextAreaElement;
  return {
    editor: () => editor,
    value: () => textarea().value,
    textarea,
    select: (start, end = start) => act(() => textarea().setSelectionRange(start, end)),
    type: (text) =>
      act(() => {
        const ta = textarea();
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
        setter.call(ta, text);
        ta.setSelectionRange(text.length, text.length);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }),
    unmount: () => act(() => { root.unmount(); host.remove(); }),
  };
}

describe('useMarkdownEditor', () => {
  let h: Harness | undefined;
  afterEach(() => h?.unmount());

  it('선택 영역을 서식으로 감싸고 선택을 유지한다', () => {
    h = mount('hello world');
    h.select(0, 5);
    act(() => h!.editor().insertFormatting('**', '**', '굵게'));
    expect(h.value()).toBe('**hello** world');
    expect(h.textarea().selectionStart).toBe(2);
    expect(h.textarea().selectionEnd).toBe(7);
  });

  it('선택이 없으면 기본 문구를 넣고 커서를 그 끝에 둔다', () => {
    h = mount('abc');
    h.select(3);
    act(() => h!.editor().insertFormatting('`', '`', 'code'));
    expect(h.value()).toBe('abc`code`');
    expect(h.textarea().selectionStart).toBe(3 + 1 + 'code'.length);
  });

  it('제목 삽입은 현재 줄의 기존 # 표시를 교체한다', () => {
    h = mount('첫 줄\n## 둘째 줄\n셋째');
    h.select(8); // 둘째 줄 안
    act(() => h!.editor().insertHeading(3));
    expect(h.value()).toBe('첫 줄\n### 둘째 줄\n셋째');
  });

  it('코드 블록: 여러 줄/무선택은 펜스, 한 줄 선택은 인라인 코드', () => {
    h = mount('one line');
    h.select(0, 3);
    act(() => h!.editor().insertCodeBlock());
    expect(h.value()).toBe('`one` line');

    h.select(0, 0);
    act(() => h!.editor().insertCodeBlock());
    expect(h.value()).toContain('```javascript\n// 코드를 입력하세요\n```');
  });

  it('되돌리기와 다시 실행이 서식 삽입 단위로 동작한다', () => {
    h = mount('text');
    h.select(0, 4);
    act(() => h!.editor().insertFormatting('*', '*', ''));
    expect(h.value()).toBe('*text*');

    act(() => h!.editor().handleUndo());
    expect(h.value()).toBe('text');

    act(() => h!.editor().handleRedo());
    expect(h.value()).toBe('*text*');
  });

  it('기록이 없을 때 되돌리기는 아무 일도 하지 않는다', () => {
    h = mount('stay');
    act(() => h!.editor().handleUndo());
    expect(h.value()).toBe('stay');
  });

  it('입력 후에도 setTimeout 없이 커서 예약이 남지 않는다 (다음 서식 삽입이 정상 동작)', () => {
    h = mount('a');
    h.type('ab');
    h.select(2);
    act(() => h!.editor().insertFormatting('[', ']', 'x'));
    expect(h.value()).toBe('ab[x]');
  });
});
