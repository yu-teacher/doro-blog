import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { Series } from '../api/types';
import { useSeriesList, type SeriesList } from './useSeriesList';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const series = (id: string, title: string) => ({ id, title, slug: id }) as unknown as Series;

function mount(username: string | undefined, enabled = true) {
  let api!: SeriesList;
  const root: Root = createRoot(document.createElement('div'));
  function Probe({ u }: { u: string | undefined }) {
    api = useSeriesList(u, enabled);
    return null;
  }
  const render = (u: string | undefined) => act(() => root.render(createElement(Probe, { u })));
  render(username);
  return { api: () => api, rerender: render, unmount: () => act(() => root.unmount()) };
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

afterEach(() => vi.restoreAllMocks());

describe('useSeriesList', () => {
  it('사용자명으로 시리즈를 불러온다 (로그아웃/미활성이면 요청하지 않는다)', async () => {
    const get = vi.spyOn(blogApi, 'getUserSeries').mockResolvedValue([series('s1', '하나')]);
    const h = mount('writer');
    await flush();
    expect(get).toHaveBeenCalledWith('writer', expect.any(AbortSignal));
    expect(h.api().series).toHaveLength(1);
    h.unmount();

    get.mockClear();
    const off = mount('writer', false);
    const none = mount(undefined);
    await flush();
    expect(get).not.toHaveBeenCalled();
    off.unmount();
    none.unmount();
  });

  it('사용자명이 바뀌면 이전 요청을 취소한다', async () => {
    const signals: AbortSignal[] = [];
    vi.spyOn(blogApi, 'getUserSeries').mockImplementation((_u, signal) => {
      signals.push(signal!);
      return new Promise(() => undefined);
    });
    const h = mount('a');
    h.rerender('b');
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
    h.unmount();
  });

  it('create 는 슬러그를 만들어 요청하고 새 시리즈를 목록 맨 앞에 넣는다', async () => {
    vi.spyOn(blogApi, 'getUserSeries').mockResolvedValue([series('old', '기존')]);
    const createSeries = vi.spyOn(blogApi, 'createSeries').mockResolvedValue(series('new', '새 시리즈'));
    const h = mount('writer');
    await flush();

    let created: Series | undefined;
    await act(async () => { created = await h.api().create('  새 시리즈  '); });
    expect(createSeries).toHaveBeenCalledWith({ title: '새 시리즈', slug: '새-시리즈' });
    expect(created!.id).toBe('new');
    expect(h.api().series.map((s) => s.id)).toEqual(['new', 'old']);
    h.unmount();
  });

  it('create 실패 시 서버 메시지로 예외를 던지고 목록은 그대로다', async () => {
    vi.spyOn(blogApi, 'getUserSeries').mockResolvedValue([series('old', '기존')]);
    vi.spyOn(blogApi, 'createSeries').mockRejectedValue(new Error('이미 사용 중인 URL 슬러그입니다.'));
    const h = mount('writer');
    await flush();

    await act(async () => {
      await expect(h.api().create('x')).rejects.toThrow('이미 사용 중인 URL 슬러그입니다.');
    });
    expect(h.api().series).toHaveLength(1);
    h.unmount();
  });
});
