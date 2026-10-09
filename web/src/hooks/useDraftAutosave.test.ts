import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraftAutosave, type DraftAutosave, type DraftSnapshot, type SaveDraft } from './useDraftAutosave';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DELAY = 5_000;

const snap = (over: Partial<DraftSnapshot> = {}): DraftSnapshot => ({
  title: 't',
  content: 'c',
  tags: [],
  summary: '',
  thumbnailUrl: '',
  slug: '',
  seriesId: '',
  ...over,
});

interface Deferred {
  promise: Promise<{ id: string }>;
  resolve: (id: string) => void;
  reject: (e: unknown) => void;
}
function deferred(): Deferred {
  let resolve!: (id: string) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<{ id: string }>((res, rej) => {
    resolve = (id) => res({ id });
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface Harness {
  api: () => DraftAutosave;
  update: (props: { snapshot?: DraftSnapshot; postId?: string | null; paused?: boolean }) => void;
  unmount: () => void;
}

function mount(save: SaveDraft, onCreated: (id: string) => void, initial: { snapshot: DraftSnapshot; postId: string | null; paused?: boolean }): Harness {
  let result: DraftAutosave | undefined;
  const root: Root = createRoot(document.createElement('div'));
  let current = { paused: false, ...initial };

  function Probe(props: typeof current) {
    result = useDraftAutosave({ snapshot: props.snapshot, postId: props.postId, save, onCreated, paused: props.paused, delayMs: DELAY });
    return null;
  }
  const render = () => act(() => root.render(createElement(Probe, current)));
  render();

  return {
    api: () => result!,
    update: (props) => {
      current = { ...current, ...props };
      render();
    },
    unmount: () => act(() => root.unmount()),
  };
}

const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('useDraftAutosave', () => {
  let harness: Harness | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    harness = undefined;
  });

  afterEach(() => {
    harness?.unmount();
    vi.useRealTimers();
  });

  it('입력이 멈춘 뒤 지연 시간이 지나야 저장하고, 새 글이면 만들어진 id 를 알려준다', async () => {
    const save = vi.fn<SaveDraft>().mockResolvedValue({ id: 'p1' });
    const onCreated = vi.fn();
    harness = mount(save, onCreated, { snapshot: snap(), postId: null });

    await tick(DELAY - 1);
    expect(save).not.toHaveBeenCalled();
    await tick(2);
    expect(save).toHaveBeenCalledWith(snap(), null);
    expect(onCreated).toHaveBeenCalledWith('p1');
    expect(harness.api().lastSavedAt).not.toBeNull();
  });

  it('입력이 계속되면 마지막 입력 후에만 저장한다 (디바운스)', async () => {
    const save = vi.fn<SaveDraft>().mockResolvedValue({ id: 'p1' });
    harness = mount(save, vi.fn(), { snapshot: snap({ content: 'a' }), postId: 'p1' });

    await tick(3_000);
    harness.update({ snapshot: snap({ content: 'ab' }) });
    await tick(3_000);
    expect(save).not.toHaveBeenCalled();
    await tick(2_500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0].content).toBe('ab');
  });

  it('저장 중에 바뀐 내용은 저장이 끝난 직후 최신 내용으로 한 번 더 저장된다', async () => {
    const first = deferred();
    const save = vi.fn<SaveDraft>().mockReturnValueOnce(first.promise).mockResolvedValue({ id: 'p1' });
    harness = mount(save, vi.fn(), { snapshot: snap({ content: 'v1' }), postId: 'p1' });

    await tick(DELAY + 1); // v1 저장 시작 (대기 중)
    expect(save).toHaveBeenCalledTimes(1);

    harness.update({ snapshot: snap({ content: 'v2' }) });
    await tick(DELAY + 1); // 저장 중이라 바로 나가지 못하고 대기열에 쌓인다
    expect(save).toHaveBeenCalledTimes(1);

    first.resolve('p1');
    await tick(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]![0].content).toBe('v2');
  });

  it('저장 중에는 요청이 겹치지 않아 첫 저장에서 글이 중복 생성되지 않는다', async () => {
    const first = deferred();
    const save = vi.fn<SaveDraft>().mockReturnValueOnce(first.promise).mockResolvedValue({ id: 'p1' });
    harness = mount(save, vi.fn(), { snapshot: snap({ content: 'v1' }), postId: null });

    await tick(DELAY + 1);
    harness.update({ snapshot: snap({ content: 'v2' }) });
    await tick(DELAY + 1);
    expect(save).toHaveBeenCalledTimes(1); // 새 글 생성 요청은 하나뿐

    first.resolve('p1');
    await tick(0);
    expect(save.mock.calls[1]![1]).toBe('p1'); // 두 번째는 방금 만들어진 글을 수정한다
  });

  it('내용이 이미 저장된 것과 같으면 다시 저장하지 않는다', async () => {
    const save = vi.fn<SaveDraft>().mockResolvedValue({ id: 'p1' });
    harness = mount(save, vi.fn(), { snapshot: snap(), postId: 'p1' });
    await tick(DELAY + 1);
    harness.update({ snapshot: snap({ title: 'x' }) });
    harness.update({ snapshot: snap() });
    await tick(DELAY + 1);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('제목과 본문이 모두 비어 있으면 저장하지 않는다', async () => {
    const save = vi.fn<SaveDraft>().mockResolvedValue({ id: 'p1' });
    harness = mount(save, vi.fn(), { snapshot: snap({ title: ' ', content: '' }), postId: null });
    await tick(DELAY * 2);
    expect(save).not.toHaveBeenCalled();
  });

  it('paused 인 동안(본문을 불러오는 중)에는 저장하지 않고, 풀리면 저장한다', async () => {
    const save = vi.fn<SaveDraft>().mockResolvedValue({ id: 'p1' });
    harness = mount(save, vi.fn(), { snapshot: snap({ content: '요약뿐' }), postId: 'p1', paused: true });
    await tick(DELAY * 2);
    expect(save).not.toHaveBeenCalled();

    harness.update({ snapshot: snap({ content: '전체 본문' }), paused: false });
    await tick(DELAY + 1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0].content).toBe('전체 본문');
  });

  it('suspend 는 진행 중인 저장이 끝나기를 기다리고 이후 자동 저장을 막는다', async () => {
    const first = deferred();
    const save = vi.fn<SaveDraft>().mockReturnValueOnce(first.promise).mockResolvedValue({ id: 'p1' });
    harness = mount(save, vi.fn(), { snapshot: snap({ content: 'v1' }), postId: 'p1' });
    await tick(DELAY + 1);

    let suspended = false;
    const pending = harness.api().suspend().then(() => { suspended = true; });
    await tick(0);
    expect(suspended).toBe(false); // 아직 저장 중

    first.resolve('p1');
    await act(async () => { await pending; });
    expect(suspended).toBe(true);

    harness.update({ snapshot: snap({ content: 'v2' }) });
    await tick(DELAY * 2);
    expect(save).toHaveBeenCalledTimes(1); // suspend 이후에는 저장하지 않는다

    act(() => harness!.api().resume());
    await tick(0);
    expect(save).toHaveBeenCalledTimes(2); // 재개하면 멈춰 있는 동안 바뀐 내용을 저장한다
  });

  it('저장 실패는 error 로 알리고, 다음 변경 때 다시 시도한다', async () => {
    const save = vi.fn<SaveDraft>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ id: 'p1' });
    harness = mount(save, vi.fn(), { snapshot: snap({ content: 'v1' }), postId: 'p1' });
    await tick(DELAY + 1);
    expect(harness.api().error).toBeInstanceOf(Error);
    expect(harness.api().saving).toBe(false);

    harness.update({ snapshot: snap({ content: 'v2' }) });
    await tick(DELAY + 1);
    expect(save).toHaveBeenCalledTimes(2);
    expect(harness.api().error).toBeNull();
  });

  it('편집 대상 글이 바뀌면(임시글 선택) 새 글 기준으로 저장한다', async () => {
    const save = vi.fn<SaveDraft>().mockResolvedValue({ id: 'p2' });
    harness = mount(save, vi.fn(), { snapshot: snap({ content: 'a' }), postId: 'p1' });
    await tick(DELAY + 1);

    harness.update({ postId: 'p2', snapshot: snap({ content: 'b' }) });
    await tick(DELAY + 1);
    expect(save.mock.calls[1]![1]).toBe('p2');
  });
  it('저장 중에 다른 글로 바꿔도, 늦게 끝난 이전 글의 저장이 지금 글의 id 를 덮어쓰지 않는다', async () => {
    const first = deferred();
    const save = vi.fn<SaveDraft>().mockReturnValueOnce(first.promise).mockResolvedValue({ id: 'B' });
    harness = mount(save, vi.fn(), { snapshot: snap({ content: 'a' }), postId: 'A' });
    await tick(DELAY + 1); // A 의 저장이 시작돼 아직 끝나지 않았다
    expect(save).toHaveBeenCalledTimes(1);

    harness.update({ postId: 'B', snapshot: snap({ content: 'b' }) }); // 사용자가 임시글 B 를 골랐다
    first.resolve('A'); // 이전 글의 저장이 뒤늦게 끝난다
    await tick(0);
    await tick(DELAY + 1);

    const last = save.mock.calls.at(-1)!;
    expect(last[0].content).toBe('b');
    expect(last[1], 'B 의 내용이 A 에 저장되면 안 된다').toBe('B');
  });
});
