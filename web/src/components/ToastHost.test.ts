import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastHost, TOAST_DURATION_MS } from './ToastHost';
import { MAX_VISIBLE_TOASTS } from '../store/toastStore';
import { notify } from '../utils/notify';
import { clearToasts, toastMessages } from '../test/toasts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLElement | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  clearToasts();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(createElement(ToastHost)));
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.useRealTimers();
  clearToasts();
});

describe('ToastHost / notify', () => {
  it('오류는 role=alert, 안내는 role=status 로 화면에 나타난다', () => {
    act(() => { notify.error('저장에 실패했습니다.'); notify.info('저장되었습니다.'); });

    expect(host!.querySelector('[role="alert"]')?.textContent).toContain('저장에 실패했습니다.');
    expect(host!.querySelector('[role="status"]')?.textContent).toContain('저장되었습니다.');
  });

  it('같은 메시지는 겹쳐 쌓이지 않고 하나만 보인다', () => {
    act(() => { notify.error('같은 오류'); notify.error('같은 오류'); notify.error('같은 오류'); });

    expect(toastMessages()).toEqual(['같은 오류']);
  });

  it(`최대 ${MAX_VISIBLE_TOASTS}개까지만 보이고 넘치면 오래된 것부터 사라진다`, () => {
    act(() => { for (let i = 1; i <= MAX_VISIBLE_TOASTS + 2; i++) notify.info(`메시지 ${i}`); });

    expect(toastMessages()).toHaveLength(MAX_VISIBLE_TOASTS);
    expect(toastMessages()).not.toContain('메시지 1');
    expect(toastMessages()).toContain(`메시지 ${MAX_VISIBLE_TOASTS + 2}`);
  });

  it('닫기 버튼을 누르면 사라진다', () => {
    act(() => notify.info('닫을 알림'));
    act(() => { (host!.querySelector('button[aria-label="알림 닫기"]') as HTMLButtonElement).click(); });

    expect(toastMessages()).toEqual([]);
    expect(host!.textContent).toBe('');
  });

  it('시간이 지나면 저절로 사라지고, 오류는 안내보다 오래 남는다', () => {
    act(() => { notify.info('안내'); notify.error('오류'); });

    act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS.info + 1); });
    expect(toastMessages()).toEqual(['오류']);

    act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS.error); });
    expect(toastMessages()).toEqual([]);
  });
});
