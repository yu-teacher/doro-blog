import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyToClipboard, type CopyToClipboard } from './useCopyToClipboard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(): { api: () => CopyToClipboard; unmount: () => void } {
  let api!: CopyToClipboard;
  const root: Root = createRoot(document.createElement('div'));
  function Probe() {
    api = useCopyToClipboard(1000);
    return null;
  }
  act(() => root.render(createElement(Probe)));
  return { api: () => api, unmount: () => act(() => root.unmount()) };
}

describe('useCopyToClipboard', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('복사하면 copied 가 true 가 되고 지정한 시간 뒤에 false 로 돌아온다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const h = mount();

    let ok = false;
    await act(async () => { ok = await h.api().copy('hello'); });
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(h.api().copied).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(1001); });
    expect(h.api().copied).toBe(false);
    h.unmount();
  });

  it('복사에 실패하면 false 를 돌려주고 copied 를 켜지 않는다', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const h = mount();

    let ok = true;
    await act(async () => { ok = await h.api().copy('x'); });
    expect(ok).toBe(false);
    expect(h.api().copied).toBe(false);
    h.unmount();
  });

  it('언마운트 후에는 타이머가 남아 상태를 바꾸지 않는다', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const h = mount();
    await act(async () => { await h.api().copy('x'); });
    h.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
