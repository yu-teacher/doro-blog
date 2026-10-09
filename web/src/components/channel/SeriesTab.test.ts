import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Series } from '../../api/types';
import { SeriesTab } from './SeriesTab';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLElement | undefined;

const series = (id: string): Series => ({ id, slug: `s-${id}`, title: `시리즈 ${id}`, postCount: 1, updatedAt: '2026-01-01T00:00:00Z' }) as unknown as Series;

function render(props: Partial<Parameters<typeof SeriesTab>[0]>) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(createElement(MemoryRouter, null,
    createElement(SeriesTab, { cleanUsername: 'me', seriesList: [], loading: false, ...props }))));
}

const createButton = () => [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('새 시리즈'));

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

describe('SeriesTab', () => {
  it('내 채널에서만 "새 시리즈" 버튼이 보이고, 누르면 만들기를 시작한다', () => {
    const onCreate = vi.fn();
    render({ isMyChannel: true, onCreateSeries: onCreate, seriesList: [series('a')] });

    act(() => { createButton()!.click(); });

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('다른 사람의 채널이나 비로그인에서는 버튼이 없다', () => {
    render({ isMyChannel: false, onCreateSeries: vi.fn(), seriesList: [series('a')] });
    expect(createButton()).toBeUndefined();
  });

  it('시리즈가 하나도 없는 내 채널에는 첫 시리즈를 만들라는 안내가 보인다', () => {
    render({ isMyChannel: true, onCreateSeries: vi.fn(), seriesList: [] });
    expect(host!.textContent).toContain('등록된 시리즈가 없습니다');
    expect(host!.textContent).toContain('첫 시리즈');
  });

  it('시리즈가 없는 남의 채널에는 만들라는 안내가 없다', () => {
    render({ isMyChannel: false, seriesList: [] });
    expect(host!.textContent).toContain('등록된 시리즈가 없습니다');
    expect(host!.textContent).not.toContain('첫 시리즈');
  });

  it('시리즈 목록의 각 항목은 시리즈 주소로 연결된다', () => {
    render({ seriesList: [series('a')] });
    expect(host!.querySelector('a')?.getAttribute('href')).toBe('/@me/series/s-a');
  });
});
