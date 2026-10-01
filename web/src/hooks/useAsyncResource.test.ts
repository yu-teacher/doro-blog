import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useAsyncResource, type AsyncResource } from './useAsyncResource';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mount(fetcher: (key: string, signal: AbortSignal) => Promise<string>, firstKey: string, enabled = true) {
  let result: AsyncResource<string> | undefined;
  const root: Root = createRoot(document.createElement('div'));
  function Probe({ k, on }: { k: string; on: boolean }) {
    result = useAsyncResource<string>((signal) => fetcher(k, signal), [k], { enabled: on });
    return null;
  }
  const render = (k: string, on = true) => act(() => root.render(createElement(Probe, { k, on })));
  render(firstKey, enabled);
  return { current: () => result!, rerender: render, unmount: () => act(() => root.unmount()) };
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('useAsyncResource', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => unmount?.());

  it('값을 불러오면 data 에 담고 loading 을 끈다', async () => {
    const h = mount(async (k) => `value-${k}`, 'a');
    unmount = h.unmount;
    expect(h.current().loading).toBe(true);
    await flush();
    expect(h.current().data).toBe('value-a');
    expect(h.current().loading).toBe(false);
  });

  it('deps 가 바뀐 뒤 늦게 도착한 이전 응답은 무시하고, 이전 요청은 abort 된다', async () => {
    const pending = new Map<string, Deferred<string>>();
    const signals = new Map<string, AbortSignal>();
    const h = mount((k, signal) => {
      const d = deferred<string>();
      pending.set(k, d);
      signals.set(k, signal);
      return d.promise;
    }, 'old');
    unmount = h.unmount;

    h.rerender('new');
    expect(signals.get('old')!.aborted).toBe(true);
    pending.get('new')!.resolve('new-value');
    await flush();
    pending.get('old')!.resolve('old-value');
    await flush();

    expect(h.current().data).toBe('new-value');
  });

  it('실패는 error 로 노출되고 reload 로 다시 시도할 수 있다', async () => {
    let attempt = 0;
    const h = mount(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('불러오기 실패');
      return 'ok';
    }, 'a');
    unmount = h.unmount;
    await flush();
    expect(h.current().error).toBe('불러오기 실패');
    expect(h.current().loading).toBe(false);

    act(() => h.current().reload());
    await flush();
    expect(h.current().error).toBeNull();
    expect(h.current().data).toBe('ok');
  });

  it('enabled 가 false 이면 요청하지 않는다', async () => {
    let calls = 0;
    const h = mount(async () => {
      calls += 1;
      return 'x';
    }, 'a', false);
    unmount = h.unmount;
    await flush();
    expect(calls).toBe(0);
    expect(h.current().loading).toBe(false);
    expect(h.current().data).toBeNull();
  });

  it('setData 로 화면에서 값을 직접 바꿀 수 있다', async () => {
    const h = mount(async () => 'server', 'a');
    unmount = h.unmount;
    await flush();
    act(() => h.current().setData('local'));
    expect(h.current().data).toBe('local');
  });
});
