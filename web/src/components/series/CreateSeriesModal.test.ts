import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../../api/blogApi';
import type { Series } from '../../api/types';
import { CreateSeriesModal, SERIES_DESCRIPTION_MAX, SERIES_TITLE_MAX } from './CreateSeriesModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
const onCreated = vi.fn();
const onClose = vi.fn();

async function flush() {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

function render() {
  root = createRoot(document.body.appendChild(document.createElement('div')));
  act(() => root!.render(createElement(CreateSeriesModal, { onCreated, onClose })));
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
const submitButton = () => [...document.querySelectorAll('button')].find((b) => b.type === 'submit') as HTMLButtonElement;

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const submit = async () => {
  await act(async () => { (document.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await flush();
};

beforeEach(() => {
  vi.restoreAllMocks();
  onCreated.mockReset();
  onClose.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  root = undefined;
});

describe('CreateSeriesModal', () => {
  it('제목이 비어 있거나 공백뿐이면 만들 수 없다', () => {
    render();
    expect(submitButton().disabled).toBe(true);

    type(field('series-title'), '   ');
    expect(submitButton().disabled).toBe(true);

    type(field('series-title'), '스프링');
    expect(submitButton().disabled).toBe(false);
  });

  it('제목·설명의 앞뒤 공백을 정리해 서버에 보내고, 비어 있는 설명은 보내지 않는다', async () => {
    const created = { id: 's1', slug: 'spring' } as unknown as Series;
    const api = vi.spyOn(blogApi, 'createSeries').mockResolvedValue(created);
    render();

    type(field('series-title'), '  스프링 시작하기  ');
    type(field('series-description'), '   ');
    await submit();

    expect(api).toHaveBeenCalledWith({ title: '스프링 시작하기', description: undefined });
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it('설명을 적으면 함께 보낸다', async () => {
    const api = vi.spyOn(blogApi, 'createSeries').mockResolvedValue({ id: 's1', slug: 'a' } as unknown as Series);
    render();

    type(field('series-title'), '제목');
    type(field('series-description'), ' 설명입니다 ');
    await submit();

    expect(api).toHaveBeenCalledWith({ title: '제목', description: '설명입니다' });
  });

  it('실패하면 이유를 보여 주고 입력은 그대로 두며, 다시 시도할 수 있다', async () => {
    vi.spyOn(blogApi, 'createSeries').mockRejectedValue(new Error('시리즈 제목은 필수입니다.'));
    render();
    type(field('series-title'), '제목');

    await submit();

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('시리즈 제목은 필수입니다.');
    expect(field('series-title').value).toBe('제목');
    expect(onCreated).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
  });

  it('저장하는 동안에는 버튼이 잠겨 같은 시리즈가 두 번 만들어지지 않는다', async () => {
    let finish: (s: Series) => void = () => undefined;
    const api = vi.spyOn(blogApi, 'createSeries').mockReturnValue(new Promise<Series>((resolve) => { finish = resolve; }));
    render();
    type(field('series-title'), '제목');

    await submit();
    expect(submitButton().disabled).toBe(true);
    await submit();
    expect(api).toHaveBeenCalledTimes(1);

    await act(async () => { finish({ id: 's1', slug: 'a' } as unknown as Series); });
    await flush();
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('입력 길이는 서버 한도(제목 100자, 설명 2000자)로 제한된다', () => {
    render();
    expect(field('series-title').maxLength).toBe(SERIES_TITLE_MAX);
    expect(field('series-description').maxLength).toBe(SERIES_DESCRIPTION_MAX);
    expect(SERIES_TITLE_MAX).toBe(100);
    expect(SERIES_DESCRIPTION_MAX).toBe(2000);
  });
});
