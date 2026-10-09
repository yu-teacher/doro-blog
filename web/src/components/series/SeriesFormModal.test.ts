import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../../api/blogApi';
import type { Series } from '../../api/types';
import { SeriesFormModal, SERIES_DESCRIPTION_MAX, SERIES_TITLE_MAX } from './SeriesFormModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
const onSaved = vi.fn();
const onClose = vi.fn();

async function flush() {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

function render(series?: Series) {
  root = createRoot(document.body.appendChild(document.createElement('div')));
  act(() => root!.render(createElement(SeriesFormModal, { series, onSaved, onClose })));
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
  onSaved.mockReset();
  onClose.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  root = undefined;
});

describe('SeriesFormModal (만들기)', () => {
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
    expect(onSaved).toHaveBeenCalledWith(created);
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
    expect(onSaved).not.toHaveBeenCalled();
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
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('입력 길이는 서버 한도(제목 100자, 설명 2000자)로 제한된다', () => {
    render();
    expect(field('series-title').maxLength).toBe(SERIES_TITLE_MAX);
    expect(field('series-description').maxLength).toBe(SERIES_DESCRIPTION_MAX);
    expect(SERIES_TITLE_MAX).toBe(100);
    expect(SERIES_DESCRIPTION_MAX).toBe(2000);
  });
});

describe('SeriesFormModal (수정)', () => {
  const existing = { id: 's1', slug: 'spring', title: '스프링', description: '기존 설명' } as unknown as Series;

  it('기존 제목과 설명이 채워져 있고, 바꾼 것이 없으면 저장할 수 없다', () => {
    render(existing);

    expect(field('series-title').value).toBe('스프링');
    expect(field('series-description').value).toBe('기존 설명');
    expect(document.body.textContent).toContain('시리즈 정보 수정');
    expect(submitButton().textContent).toBe('저장');
    expect(submitButton().disabled).toBe(true);

    type(field('series-title'), '스프링 부트');
    expect(submitButton().disabled).toBe(false);
  });

  it('수정은 updateSeries 로 저장하고 결과를 넘긴다 (주소는 보내지 않아 바뀌지 않는다)', async () => {
    const saved = { ...existing, title: '새 제목' } as unknown as Series;
    const update = vi.spyOn(blogApi, 'updateSeries').mockResolvedValue(saved);
    const create = vi.spyOn(blogApi, 'createSeries');
    render(existing);

    type(field('series-title'), '  새 제목  ');
    await submit();

    expect(update).toHaveBeenCalledWith('s1', { title: '새 제목', description: '기존 설명' });
    expect(create).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it('설명을 지우면 빈 문자열을 보내 서버의 설명이 지워진다 (생략은 "그대로 둠"이다)', async () => {
    const update = vi.spyOn(blogApi, 'updateSeries').mockResolvedValue(existing);
    render(existing);

    type(field('series-description'), '');
    await submit();

    expect(update).toHaveBeenCalledWith('s1', { title: '스프링', description: '' });
  });

  it('수정이 실패하면 이유를 보여 주고 대화상자를 닫지 않는다', async () => {
    vi.spyOn(blogApi, 'updateSeries').mockRejectedValue(new Error('권한이 없습니다.'));
    render(existing);
    type(field('series-title'), '다른 제목');

    await submit();

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('권한이 없습니다.');
    expect(onSaved).not.toHaveBeenCalled();
  });
});
