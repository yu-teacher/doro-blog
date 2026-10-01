import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { Comment, UserProfile } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { CommentSection } from './CommentSection';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const comment = (id: string, over: Partial<Comment> = {}): Comment =>
  ({ id, userId: 'other', username: 'other', nickname: '남', content: `내용 ${id}`, isDeleted: false, createdAt: '2026-01-01T00:00:00Z', replies: [], ...over }) as unknown as Comment;

const me = { id: 'me', username: 'me', nickname: '나' } as unknown as UserProfile;

let root: Root | undefined;
let host: HTMLElement | undefined;
const onUpdated = vi.fn();

function render(comments: Comment[]) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(createElement(CommentSection, { postId: 'p1', comments, onCommentUpdated: onUpdated })));
}

const typeInto = (el: HTMLTextAreaElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const button = (text: string) => [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('CommentSection', () => {
  beforeEach(() => {
    onUpdated.mockClear();
    useAuthStore.setState({ isAuthenticated: true, user: me });
  });
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    vi.restoreAllMocks();
  });

  it('댓글 수(답글 포함)와 내용을 보여주고, 삭제된 댓글은 안내 문구로 바꾼다', () => {
    render([comment('c1', { replies: [comment('r1')] }), comment('c2', { isDeleted: true })]);
    expect(host!.textContent).toContain('3개의 댓글');
    expect(host!.textContent).toContain('내용 c1');
    expect(host!.textContent).toContain('내용 r1');
    expect(host!.textContent).toContain('삭제된 댓글입니다.');
    expect(host!.textContent).not.toContain('내용 c2');
  });

  it('비로그인이면 입력이 막혀 있다', () => {
    useAuthStore.setState({ isAuthenticated: false, user: null });
    render([]);
    expect((host!.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(true);
    expect(host!.textContent).toContain('첫 번째 댓글을 남겨보세요');
  });

  it('댓글을 쓰면 공백을 다듬어 등록하고 입력창을 비운 뒤 목록 갱신을 알린다', async () => {
    const create = vi.spyOn(blogApi, 'createComment').mockResolvedValue({} as Comment);
    render([]);
    const box = host!.querySelector('textarea') as HTMLTextAreaElement;
    expect(box.maxLength).toBe(2000);
    typeInto(box, '  안녕하세요  ');

    await act(async () => { (host!.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await flush();
    expect(create).toHaveBeenCalledWith('p1', '안녕하세요');
    expect(box.value).toBe('');
    expect(onUpdated).toHaveBeenCalledTimes(1);
  });

  it('답글: 답글 달기로 입력창을 열고 작성하면 부모 댓글 id 와 함께 등록한다', async () => {
    const create = vi.spyOn(blogApi, 'createComment').mockResolvedValue({} as Comment);
    render([comment('c1')]);

    act(() => button('답글 달기').click());
    const boxes = host!.querySelectorAll('textarea');
    expect(boxes).toHaveLength(2);
    typeInto(boxes[1] as HTMLTextAreaElement, '답글입니다');
    await act(async () => { button('답글 작성').click(); });
    await flush();

    expect(create).toHaveBeenCalledWith('p1', '답글입니다', 'c1');
    expect(host!.querySelectorAll('textarea')).toHaveLength(1); // 입력창 닫힘
  });

  it('내 댓글에만 삭제 버튼이 있고, 확인 후 삭제하면 목록 갱신을 알린다', async () => {
    const del = vi.spyOn(blogApi, 'deleteComment').mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render([comment('c1', { userId: 'me' }), comment('c2')]);

    const deleteButtons = host!.querySelectorAll('button[title="댓글 삭제"]');
    expect(deleteButtons).toHaveLength(1);
    await act(async () => { (deleteButtons[0] as HTMLButtonElement).click(); });
    await flush();
    expect(del).toHaveBeenCalledWith('c1');
    expect(onUpdated).toHaveBeenCalledTimes(1);
  });

  it('등록 실패 시 서버 메시지를 알려주고 입력은 유지한다', async () => {
    vi.spyOn(blogApi, 'createComment').mockRejectedValue(new Error('댓글은 최대 2000자까지 작성 가능합니다.'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    render([]);
    const box = host!.querySelector('textarea') as HTMLTextAreaElement;
    typeInto(box, '내용');
    await act(async () => { (host!.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await flush();

    expect(alertSpy).toHaveBeenCalledWith('댓글은 최대 2000자까지 작성 가능합니다.');
    expect(box.value).toBe('내용');
  });
});
