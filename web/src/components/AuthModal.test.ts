import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { AuthModal } from './AuthModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;

const render = () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(AuthModal)));
};

function typeInto(el: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('AuthModal', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ loginModalOpen: false });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('닫혀 있으면 아무것도 렌더하지 않는다', () => {
    render();
    expect(host.innerHTML).toBe('');
  });

  it('저장된 계정이 없으면 열릴 때 이메일/비밀번호 입력 화면이 나온다', () => {
    render();
    act(() => useAuthStore.getState().openLoginModal());
    expect(host.querySelector('input[type="password"]')).not.toBeNull();
  });

  it('저장된 계정이 있으면 계정 선택 화면이 먼저 나온다', () => {
    localStorage.setItem('doro_saved_accounts', JSON.stringify([{ userId: 'u1', email: 'a@doro.test', name: 'A', lastUsedAt: 1 }]));
    render();
    act(() => useAuthStore.getState().openLoginModal());
    expect(host.textContent).toContain('a@doro.test');
    expect(host.querySelector('input[type="password"]')).toBeNull();
  });

  it('로그인 성공 시 입력한 이메일/비밀번호로 loginWithIam 을 호출하고 모달을 닫는다', async () => {
    const loginWithIam = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ loginWithIam });
    render();
    act(() => useAuthStore.getState().openLoginModal());

    typeInto(host.querySelector('input[type="email"]') as HTMLInputElement, '  me@doro.test ');
    typeInto(host.querySelector('input[type="password"]') as HTMLInputElement, 'secret-pw');
    await act(async () => {
      (host.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(loginWithIam).toHaveBeenCalledWith('me@doro.test', 'secret-pw');
    expect(useAuthStore.getState().loginModalOpen).toBe(false);
  });

  it('로그인 실패 시 서버가 준 메시지를 보여준다 (없으면 기본 문구)', async () => {
    const loginWithIam = vi
      .fn()
      .mockRejectedValueOnce({ response: { data: { error: { message: '비밀번호가 올바르지 않습니다.' } } } })
      .mockRejectedValueOnce(new Error('network'));
    useAuthStore.setState({ loginWithIam });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render();
    act(() => useAuthStore.getState().openLoginModal());
    typeInto(host.querySelector('input[type="email"]') as HTMLInputElement, 'me@doro.test');
    typeInto(host.querySelector('input[type="password"]') as HTMLInputElement, 'x');

    const submit = async () => {
      await act(async () => {
        (host.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      await flush();
    };
    await submit();
    expect(host.textContent).toContain('비밀번호가 올바르지 않습니다.');

    await submit();
    expect(host.textContent).toContain('로그인에 실패했습니다');
    expect(useAuthStore.getState().loginModalOpen).toBe(true);
  });
});
