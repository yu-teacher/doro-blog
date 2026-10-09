import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../../api/blogApi';
import type { PostSummary, SeriesDetail, SeriesItemPost } from '../../api/types';
import { clearToasts, toastMessages } from '../../test/toasts';
import { SeriesPostManager } from './SeriesPostManager';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (id: string, order: number, over: Partial<SeriesItemPost> = {}): SeriesItemPost =>
  ({ id, seriesOrder: order, title: `글 ${id}`, slug: `slug-${id}`, status: 'PUBLISHED', ...over }) as SeriesItemPost;

const detailOf = (posts: SeriesItemPost[]): SeriesDetail =>
  ({ series: { id: 's1', userId: 'me', username: 'me', title: '시리즈', slug: 's', postCount: posts.length }, posts }) as unknown as SeriesDetail;

let root: Root | undefined;
let host: HTMLElement | undefined;
const onChange = vi.fn();

async function flush() {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

function render(detail: SeriesDetail) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(createElement(MemoryRouter, null, createElement(SeriesPostManager, { detail, username: 'me', onChange }))));
}

const titles = () => [...host!.querySelectorAll('ol > li a')].map((a) => a.textContent);
const button = (label: string) => host!.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); await flush(); };

/** jsdom 에는 DataTransfer 가 없어서, 드래그 이벤트에 최소한의 dataTransfer 를 달아 준다. */
function drag(type: string, target: Element) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { setData: () => undefined, effectAllowed: '', dropEffect: '' } });
  act(() => { target.dispatchEvent(ev); });
}

beforeEach(() => {
  vi.restoreAllMocks();
  onChange.mockReset();
  clearToasts();
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('SeriesPostManager', () => {
  it('회차 순서대로 글을 보여 주고, 맨 위/맨 아래 글의 이동 버튼은 막혀 있다', () => {
    render(detailOf([item('a', 1), item('b', 2), item('c', 3)]));

    expect(titles()).toEqual(['글 a', '글 b', '글 c']);
    expect(button('글 a 위로 이동').disabled).toBe(true);
    expect(button('글 c 아래로 이동').disabled).toBe(true);
    expect(button('글 b 위로 이동').disabled).toBe(false);
  });

  it('아래로 이동 버튼은 서버에 새 순서를 저장하고, 응답으로 화면과 상위 상태를 맞춘다', async () => {
    const saved = detailOf([item('b', 1), item('a', 2), item('c', 3)]);
    const reorder = vi.spyOn(blogApi, 'reorderSeries').mockResolvedValue(saved);
    render(detailOf([item('a', 1), item('b', 2), item('c', 3)]));

    await click(button('글 a 아래로 이동'));

    expect(reorder).toHaveBeenCalledWith('s1', ['b', 'a', 'c']);
    expect(onChange).toHaveBeenCalledWith(saved);
    expect(titles()).toEqual(['글 b', '글 a', '글 c']);
  });

  it('저장이 실패하면 원래 순서로 되돌리고 이유를 알린다', async () => {
    vi.spyOn(blogApi, 'reorderSeries').mockRejectedValue(new Error('서버가 거절했습니다.'));
    render(detailOf([item('a', 1), item('b', 2)]));

    await click(button('글 a 아래로 이동'));

    expect(titles()).toEqual(['글 a', '글 b']);
    expect(onChange).not.toHaveBeenCalled();
    expect(toastMessages()).toContain('서버가 거절했습니다.');
  });

  it('끌어서 놓으면 그 자리로 옮겨 저장한다', async () => {
    const reorder = vi.spyOn(blogApi, 'reorderSeries').mockResolvedValue(detailOf([item('b', 1), item('c', 2), item('a', 3)]));
    render(detailOf([item('a', 1), item('b', 2), item('c', 3)]));
    const rows = host!.querySelectorAll('ol > li');

    drag('dragstart', rows[0]);
    drag('dragover', rows[2]);
    drag('drop', rows[2]);
    await flush();

    expect(reorder).toHaveBeenCalledWith('s1', ['b', 'c', 'a']);
  });

  it('제자리에 놓거나 끌기를 시작하지 않은 채 놓으면 저장하지 않는다', async () => {
    const reorder = vi.spyOn(blogApi, 'reorderSeries').mockResolvedValue(detailOf([]));
    render(detailOf([item('a', 1), item('b', 2)]));
    const rows = host!.querySelectorAll('ol > li');

    drag('dragstart', rows[0]);
    drag('drop', rows[0]);
    drag('drop', rows[1]);
    await flush();

    expect(reorder).not.toHaveBeenCalled();
  });

  it('저장하는 동안에는 다른 이동을 받지 않는다 (요청이 뒤섞이지 않게)', async () => {
    let finish: (d: SeriesDetail) => void = () => undefined;
    const reorder = vi.spyOn(blogApi, 'reorderSeries').mockReturnValue(new Promise<SeriesDetail>((resolve) => { finish = resolve; }));
    render(detailOf([item('a', 1), item('b', 2), item('c', 3)]));

    await click(button('글 a 아래로 이동'));
    expect(button('글 c 위로 이동').disabled).toBe(true);
    await click(button('글 c 위로 이동'));
    expect(reorder).toHaveBeenCalledTimes(1);

    await act(async () => { finish(detailOf([item('b', 1), item('a', 2), item('c', 3)])); });
    await flush();
    expect(button('글 c 위로 이동').disabled).toBe(false);
  });

  it('시리즈에서 빼기는 확인을 거쳐 서버에 요청하고, 취소하면 아무것도 하지 않는다', async () => {
    const saved = detailOf([item('b', 1)]);
    const removeApi = vi.spyOn(blogApi, 'removeSeriesPost').mockResolvedValue(saved);
    render(detailOf([item('a', 1), item('b', 2)]));

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await click(button('글 a 시리즈에서 빼기'));
    expect(removeApi).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await click(button('글 a 시리즈에서 빼기'));
    expect(removeApi).toHaveBeenCalledWith('s1', 'a');
    expect(onChange).toHaveBeenCalledWith(saved);
  });

  it('글 추가: 시리즈에 속하지 않은 글만 보여 주고, 추가하면 서버에 요청한다', async () => {
    const myPost = (id: string, over: Partial<PostSummary> = {}) =>
      ({ id, title: `내 글 ${id}`, slug: id, status: 'DRAFT', ...over }) as unknown as PostSummary;
    vi.spyOn(blogApi, 'getMyPosts').mockResolvedValue({
      content: [myPost('free'), myPost('taken', { seriesId: 'other' }), myPost('a')],
      last: true,
    } as never);
    const saved = detailOf([item('a', 1), item('free', 2)]);
    const addApi = vi.spyOn(blogApi, 'addSeriesPost').mockResolvedValue(saved);
    render(detailOf([item('a', 1)]));

    await click(host!.ownerDocument.evaluate('//button[contains(., "글 추가")]', host!, null, 9, null).singleNodeValue as Element);
    await flush();

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('내 글 free');
    expect(dialog.textContent, '다른 시리즈의 글은 숨긴다').not.toContain('내 글 taken');
    expect(dialog.textContent, '이미 이 시리즈에 있는 글은 숨긴다').not.toContain('내 글 a');

    const addButton = [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === '추가') as HTMLButtonElement;
    await click(addButton);

    expect(addApi).toHaveBeenCalledWith('s1', 'free');
    expect(onChange).toHaveBeenCalledWith(saved);
  });
});
