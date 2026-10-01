import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { NotificationItem, PageResponse } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { NotificationDropdown } from './NotificationDropdown';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (id: string, over: Partial<NotificationItem> = {}): NotificationItem =>
  ({ id, type: 'COMMENT', isRead: false, createdAt: new Date().toISOString(), targetPostTitle: '글 제목', targetPostSlug: 'post-1',
     targetUsername: 'owner', sender: { id: 's', username: 'sender', nickname: '보낸이' }, ...over }) as NotificationItem;

const page = (content: NotificationItem[], totalPages = 1): PageResponse<NotificationItem> => ({
  content, totalElements: content.length, totalPages, size: 15, number: 0, first: true, last: totalPages === 1, empty: content.length === 0,
});

let root: Root | undefined;
let host: HTMLElement | undefined;
let location = '';

function Probe() {
  const l = useLocation();
  location = l.pathname;
  return null;
}

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(NotificationDropdown),
      createElement(Routes, null, createElement(Route, { path: '*', element: createElement(Probe) }))));
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const bell = () => host!.querySelector('button[aria-label="알림"]') as HTMLButtonElement;

describe('NotificationDropdown', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true });
    vi.spyOn(blogApi, 'getUnreadNotificationCount').mockResolvedValue(2);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    vi.restoreAllMocks();
  });

  it('비로그인이면 아무것도 렌더하지 않는다', async () => {
    useAuthStore.setState({ isAuthenticated: false });
    await render();
    expect(host!.innerHTML).toBe('');
  });

  it('안 읽은 수를 배지로 보여주고, 열면 알림 목록을 불러온다', async () => {
    vi.spyOn(blogApi, 'getNotifications').mockResolvedValue(page([item('n1'), item('n2', { type: 'FOLLOW', isRead: true })]));
    await render();
    expect(bell().textContent).toContain('2');

    await act(async () => { bell().click(); });
    await flush();
    expect(host!.textContent).toContain('글 제목');
    expect(host!.textContent).toContain('팔로우하기 시작했습니다');
  });

  it('알림을 누르면 읽음 처리하고 해당 글로 이동한다', async () => {
    vi.spyOn(blogApi, 'getNotifications').mockResolvedValue(page([item('n1')]));
    const markRead = vi.spyOn(blogApi, 'markNotificationAsRead').mockResolvedValue(undefined);
    await render();
    await act(async () => { bell().click(); });
    await flush();

    const row = [...host!.querySelectorAll('div')].find((d) => d.className.includes('group relative')) as HTMLElement;
    await act(async () => { row.click(); });
    await flush();

    expect(markRead).toHaveBeenCalledWith('n1');
    expect(location).toBe('/@owner/post-1');
  });

  it('목록 불러오기가 실패하면 오류와 다시 시도 버튼을 보여준다', async () => {
    vi.spyOn(blogApi, 'getNotifications').mockRejectedValue(new Error('알림 서버 오류'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await render();
    await act(async () => { bell().click(); });
    await flush();

    expect(host!.textContent).toContain('알림 서버 오류');
    expect([...host!.querySelectorAll('button')].some((b) => b.textContent?.includes('다시 시도'))).toBe(true);
  });

  it('모두 읽음을 누르면 배지가 사라진다', async () => {
    vi.spyOn(blogApi, 'getNotifications').mockResolvedValue(page([item('n1'), item('n2')]));
    vi.spyOn(blogApi, 'markAllNotificationsAsRead').mockResolvedValue(undefined);
    await render();
    await act(async () => { bell().click(); });
    await flush();

    const all = [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('모두 읽음')) as HTMLButtonElement;
    await act(async () => { all.click(); });
    await flush();
    expect(host!.textContent).not.toContain('안 읽음');
  });
});
