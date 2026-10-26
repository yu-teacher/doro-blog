import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as pushApi from '../api/pushApi';
import * as pushClient from '../push/pushClient';
import { useAuthStore } from '../store/authStore';
import { usePushStore } from '../store/pushStore';
import { PushSync } from './PushSync';

vi.mock('../api/pushApi');
vi.mock('../push/pushClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../push/pushClient')>();
  return { ...actual, detectPushSupport: vi.fn(), notificationPermission: vi.fn(), syncThisDevice: vi.fn() };
});
const client = vi.mocked(pushClient);
const api = vi.mocked(pushApi);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLElement | undefined;
let where = '';
let listener: ((event: unknown) => void) | undefined;

function Probe() {
  const location = useLocation();
  where = location.pathname + location.search;
  return null;
}

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(PushSync),
      createElement(Routes, null, createElement(Route, { path: '*', element: createElement(Probe) }))));
  });
}

describe('PushSync', () => {
  beforeEach(() => {
    listener = undefined;
    usePushStore.getState().reset();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: (_type: string, fn: (event: unknown) => void) => { listener = fn; },
        removeEventListener: vi.fn(),
      },
    });
    client.detectPushSupport.mockReturnValue('supported');
    client.notificationPermission.mockReturnValue('granted');
    client.syncThisDevice.mockResolvedValue(false);
    api.getPushConfig.mockResolvedValue({ enabled: true, publicKey: 'KEY' });
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.restoreAllMocks();
  });

  it('로그인 상태로 뜨면 이 기기의 구독을 서버와 맞추고, 비로그인이면 묻지 않는다', async () => {
    useAuthStore.setState({ isAuthenticated: false });
    await render();
    expect(api.getPushConfig).not.toHaveBeenCalled();

    act(() => root?.unmount());
    useAuthStore.setState({ isAuthenticated: true });
    await render();
    expect(client.syncThisDevice).toHaveBeenCalledWith('KEY');
  });

  it('알림을 누르면(blog-open) 새로고침 없이 앱 안에서 이동하고 처리했다고 답한다', async () => {
    useAuthStore.setState({ isAuthenticated: false });
    await render();
    const reply = vi.fn();
    const message = { data: { type: 'blog-open', url: `${window.location.origin}/@alice/hello?x=1` }, ports: [{ postMessage: reply }] };

    act(() => listener!(message));

    // 테스트 환경의 라우터 basename 은 빈 값(루트)이므로 앱 경로가 그대로 이어진다
    expect(where).toBe('/@alice/hello?x=1');
    expect(reply).toHaveBeenCalledWith('handled');
  });

  it('다른 출처 주소나 모르는 메시지는 무시하고 답하지 않는다(서비스 워커가 직접 이동시킨다)', async () => {
    useAuthStore.setState({ isAuthenticated: false });
    await render();
    const reply = vi.fn();

    act(() => listener!({ data: { type: 'blog-open', url: 'https://evil.test/x' }, ports: [{ postMessage: reply }] }));
    act(() => listener!({ data: { type: 'other', url: '/x' }, ports: [{ postMessage: reply }] }));

    expect(where).toBe('/');
    expect(reply).not.toHaveBeenCalled();
  });
});
