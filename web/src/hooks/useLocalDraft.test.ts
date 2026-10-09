import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDraftStorageKey, useLocalDraft, type LocalDraft, type LocalDraftControls } from './useLocalDraft';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = 'doro_editor_draft_test';
const DELAY = 2000;
const draft = (over: Partial<LocalDraft> = {}): LocalDraft => ({ title: 't', content: 'c', tags: [], summary: '', thumbnailUrl: '', ...over });

function mount(initial: { snapshot: LocalDraft; offerRestore: boolean }) {
  let api!: LocalDraftControls;
  const root: Root = createRoot(document.createElement('div'));
  let props = initial;
  function Probe(p: typeof initial) {
    api = useLocalDraft({ draftKey: KEY, delayMs: DELAY, ...p });
    return null;
  }
  const render = () => act(() => root.render(createElement(Probe, props)));
  render();
  return { api: () => api, update: (snapshot: LocalDraft) => { props = { ...props, snapshot }; render(); }, unmount: () => act(() => root.unmount()) };
}

describe('useLocalDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('입력이 멈춘 뒤에만 localStorage 에 저장한다', () => {
    const h = mount({ snapshot: draft(), offerRestore: false });
    act(() => { vi.advanceTimersByTime(DELAY - 1); });
    expect(localStorage.getItem(KEY)).toBeNull();
    act(() => { vi.advanceTimersByTime(2); });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ title: 't', content: 'c' });
    h.unmount();
  });

  it('제목과 본문이 모두 비어 있으면 저장하지 않는다', () => {
    const h = mount({ snapshot: draft({ title: ' ', content: '' }), offerRestore: false });
    act(() => { vi.advanceTimersByTime(DELAY * 2); });
    expect(localStorage.getItem(KEY)).toBeNull();
    h.unmount();
  });

  it('새 글 화면에서 이전 백업이 있으면 안내를 켜고, 복원하면 형식이 맞는 필드만 돌려준다', () => {
    localStorage.setItem(KEY, JSON.stringify({ title: '백업', content: '본문', tags: ['a', 3], summary: 5 }));
    const h = mount({ snapshot: draft({ title: '', content: '' }), offerRestore: true });
    expect(h.api().hasNotice).toBe(true);

    let restored: Partial<LocalDraft> | null = null;
    act(() => { restored = h.api().restore(); });
    expect(restored).toEqual({ title: '백업', content: '본문', tags: ['a'] });
    expect(h.api().hasNotice).toBe(false);
    h.unmount();
  });

  it('수정 화면(offerRestore=false)이나 내용이 빈 백업이면 안내를 켜지 않는다', () => {
    localStorage.setItem(KEY, JSON.stringify({ title: '백업', content: '본문' }));
    const edit = mount({ snapshot: draft(), offerRestore: false });
    expect(edit.api().hasNotice).toBe(false);
    edit.unmount();

    localStorage.setItem(KEY, JSON.stringify({ title: ' ', content: '' }));
    const blank = mount({ snapshot: draft(), offerRestore: true });
    expect(blank.api().hasNotice).toBe(false);
    blank.unmount();
  });

  it('손상된 백업은 안내 없이 무시하고, 버리기는 백업을 지운다', () => {
    localStorage.setItem(KEY, '{not json');
    const h = mount({ snapshot: draft(), offerRestore: true });
    expect(h.api().hasNotice).toBe(false);
    act(() => { expect(h.api().restore()).toBeNull(); });

    localStorage.setItem(KEY, JSON.stringify({ title: 'x', content: 'y' }));
    act(() => h.api().discard());
    expect(localStorage.getItem(KEY)).toBeNull();
    h.unmount();
  });
  it('복원 안내가 떠 있는 동안 새로 입력해도 이전 백업을 덮어쓰지 않는다 (복원하면 방금 쓴 내용이 아니라 백업이 돌아와야 한다)', () => {
    localStorage.setItem(KEY, JSON.stringify({ title: '백업 제목', content: '백업 본문' }));
    const h = mount({ snapshot: draft({ title: '', content: '' }), offerRestore: true });
    expect(h.api().hasNotice).toBe(true);

    h.update(draft({ title: '지금 막 쓰기 시작', content: '새 본문' }));
    act(() => { vi.advanceTimersByTime(DELAY * 2); });

    let restored: Partial<LocalDraft> | null = null;
    act(() => { restored = h.api().restore(); });
    expect(restored).toMatchObject({ title: '백업 제목', content: '백업 본문' });
    h.unmount();
  });

  it('안내를 닫은 뒤(복원이나 버리기)에는 다시 입력 내용을 백업한다', () => {
    localStorage.setItem(KEY, JSON.stringify({ title: '백업', content: '본문' }));
    const h = mount({ snapshot: draft({ title: '', content: '' }), offerRestore: true });
    act(() => { h.api().discard(); });

    h.update(draft({ title: '새 글', content: '새 본문' }));
    act(() => { vi.advanceTimersByTime(DELAY + 1); });

    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ title: '새 글' });
    h.unmount();
  });

  it('기존 글을 수정할 때의 백업은 새 글 백업과 다른 키를 쓴다 (서로 덮어쓰지 않게)', () => {
    expect(localDraftStorageKey('doro_editor_draft_me')).toBe('doro_editor_draft_me');
    expect(localDraftStorageKey('doro_editor_draft_me', 'p1')).toBe('doro_editor_draft_me:edit:p1');
    expect(localDraftStorageKey('doro_editor_draft_me', 'p1')).not.toBe(localDraftStorageKey('doro_editor_draft_me', 'p2'));
  });
});
