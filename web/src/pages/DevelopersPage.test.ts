import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { ApiKey, ApiKeyLog, PageResponse } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { DevelopersPage } from './DevelopersPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const key = (id: string, name: string): ApiKey =>
  ({ id, name, keyPrefix: `doro_live_${id}...`, expiresAt: null, lastUsedAt: null, isActive: true, createdAt: '2026-10-01T00:00:00Z' }) as unknown as ApiKey;

const log = (endpoint: string): ApiKeyLog =>
  ({ id: endpoint, apiKeyId: 'k', method: 'GET', endpoint, statusCode: 200, ipAddress: '1.1.1.1', userAgent: 'ua', durationMs: 5, errorMessage: null, createdAt: '2026-10-01T00:00:00Z' }) as ApiKeyLog;

function logPage(...endpoints: string[]): PageResponse<ApiKeyLog> {
  return { content: endpoints.map(log), totalElements: endpoints.length, totalPages: 1, size: 20, number: 0, first: true, last: true, empty: endpoints.length === 0 };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(MemoryRouter, null, createElement(DevelopersPage))); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

function selectKey(id: string) {
  const select = host!.querySelector('select') as HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  return act(async () => {
    setter.call(select, id);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
  });
}

describe('DevelopersPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, user: null });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(blogApi, 'getMyApiKeys').mockResolvedValue([key('A', '키 A'), key('B', '키 B')]);
  });
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
    vi.restoreAllMocks();
  });

  it('키 A 를 고른 뒤 B 를 골랐을 때, 늦게 도착한 A 의 로그가 B 아래에 보이지 않는다', async () => {
    const initial = deferred<PageResponse<ApiKeyLog>>();
    const forA = deferred<PageResponse<ApiKeyLog>>();
    const forB = deferred<PageResponse<ApiKeyLog>>();
    vi.spyOn(blogApi, 'getApiKeyLogs').mockImplementation((id?: string) =>
      id === 'A' ? forA.promise : id === 'B' ? forB.promise : initial.promise);
    await render();
    initial.resolve(logPage());
    await act(async () => { await Promise.resolve(); });

    await selectKey('A');
    await selectKey('B');
    await act(async () => { forB.resolve(logPage('/B-endpoint')); await Promise.resolve(); });
    await act(async () => { forA.resolve(logPage('/A-endpoint')); await Promise.resolve(); }); // 이전 선택의 응답이 늦게 도착

    expect(host!.textContent).toContain('/B-endpoint');
    expect(host!.textContent, '이전에 고른 키의 로그가 섞이면 안 된다').not.toContain('/A-endpoint');
  });

  it('다른 키로 바꾼 뒤 그 키의 로그 조회가 실패하면, 이전 키의 로그를 그대로 보여 주지 않는다', async () => {
    const forA = deferred<PageResponse<ApiKeyLog>>();
    const forB = deferred<PageResponse<ApiKeyLog>>();
    vi.spyOn(blogApi, 'getApiKeyLogs').mockImplementation((id?: string) =>
      id === 'A' ? forA.promise : id === 'B' ? forB.promise : Promise.resolve(logPage()));
    await render();
    await selectKey('A');
    await act(async () => { forA.resolve(logPage('/A-endpoint')); await Promise.resolve(); });
    expect(host!.textContent).toContain('/A-endpoint');

    await selectKey('B');
    await act(async () => { forB.reject(new Error('서버 오류')); await Promise.resolve(); });

    expect(host!.textContent, '키 B 아래에 키 A 의 로그가 남아 있으면 안 된다').not.toContain('/A-endpoint');
    expect(host!.textContent).toContain('불러오지 못했습니다');
  });
});
