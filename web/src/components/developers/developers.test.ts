import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeDocumentation } from './CodeDocumentation';
import { CreateKeyModal } from './CreateKeyModal';
import { NewKeyAlert } from './NewKeyAlert';
import { buildCodeSnippets, CODE_TABS } from './codeSnippets';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLElement | undefined;

function render(element: ReturnType<typeof createElement>) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(element));
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
});

describe('buildCodeSnippets', () => {
  const ENDPOINT = 'https://blog.example/api/v1/posts';

  it('모든 탭의 예제에 엔드포인트와 API 키 헤더가 들어간다', () => {
    const snippets = buildCodeSnippets(ENDPOINT);
    for (const tab of CODE_TABS) {
      expect(snippets[tab]).toContain(ENDPOINT);
      expect(snippets[tab]).toContain('X-API-Key');
    }
  });

  it('GitHub Actions 예제의 헤더 따옴표가 닫혀 있다', () => {
    expect(buildCodeSnippets(ENDPOINT).github).toContain('"X-API-Key: ${{ secrets.DORO_BLOG_API_KEY }}"');
  });
});

describe('CodeDocumentation', () => {
  it('탭을 바꾸면 해당 언어의 예제가 보이고 복사 버튼이 그 코드를 복사한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(createElement(CodeDocumentation, { apiEndpoint: 'https://x.test/api/v1/posts' }));

    const pythonTab = [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('Python')) as HTMLButtonElement;
    act(() => pythonTab.click());
    expect(host!.querySelector('code')?.textContent).toContain('import requests');

    const copy = [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('코드 복사')) as HTMLButtonElement;
    await act(async () => { copy.click(); });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('import requests'));
  });
});

describe('NewKeyAlert', () => {
  it('발급된 키를 보여주고, 복사/닫기 동작을 한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const onDismiss = vi.fn();
    render(createElement(NewKeyAlert, { createdKey: { apiKey: 'doro_live_abc123' } as never, onDismiss }));

    expect(host!.textContent).toContain('doro_live_abc123');
    const copy = [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('키 복사')) as HTMLButtonElement;
    await act(async () => { copy.click(); });
    expect(writeText).toHaveBeenCalledWith('doro_live_abc123');
    expect(host!.textContent).toContain('복사됨');

    const close = [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '닫기') as HTMLButtonElement;
    act(() => close.click());
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('CreateKeyModal', () => {
  it('폼 제출과 취소를 부모에게 전달한다', () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const onClose = vi.fn();
    render(createElement(CreateKeyModal, {
      keyName: 'ci', setKeyName: vi.fn(), expireDays: 30, setExpireDays: vi.fn(), issuing: false, onSubmit, onClose,
    }));

    act(() => { (host!.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    const cancel = [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === '취소') as HTMLButtonElement;
    act(() => cancel.click());
    expect(onClose).toHaveBeenCalled();
  });
});
