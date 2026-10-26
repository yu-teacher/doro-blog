import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../../api/blogApi';
import * as pushApi from '../../api/pushApi';
import * as pushClient from '../../push/pushClient';
import { useAuthStore } from '../../store/authStore';
import { usePushStore } from '../../store/pushStore';
import { NotificationDropdown } from '../NotificationDropdown';

vi.mock('../../api/pushApi');
vi.mock('../../push/pushClient');
const api = vi.mocked(pushApi);
const client = vi.mocked(pushClient);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PREFS = { comments: true, replies: true, likes: false, follows: true };

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(NotificationDropdown)));
  });
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const bell = () => host!.querySelector('button[aria-label="알림"]') as HTMLButtonElement;
const pushRow = () => document.querySelector('button[aria-label^="이 기기 푸시 알림 설정"]') as HTMLButtonElement | null;
const dialog = () => document.querySelector('[role="dialog"]');
const buttonByText = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

describe('알림 드롭다운의 푸시 알림 설정', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true });
    usePushStore.getState().reset();
    vi.spyOn(blogApi, 'getUnreadNotificationCount').mockResolvedValue(0);
    vi.spyOn(blogApi, 'getNotifications').mockResolvedValue({
      content: [], totalElements: 0, totalPages: 1, size: 15, number: 0, first: true, last: true, empty: true,
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    client.detectPushSupport.mockReturnValue('supported');
    client.notificationPermission.mockReturnValue('granted');
    client.syncThisDevice.mockResolvedValue(true);
    api.getPushConfig.mockResolvedValue({ enabled: true, publicKey: 'KEY' });
    api.getPushPreferences.mockResolvedValue(PREFS);
    api.savePushPreferences.mockImplementation(async (next) => next);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it('서버가 푸시를 끄고 있거나 브라우저가 지원하지 않거나 확인 전이면 줄을 숨긴다', async () => {
    await render();
    await act(async () => { bell().click(); });
    expect(pushRow()).toBeNull();   // loading

    for (const status of ['server-disabled', 'unsupported'] as const) {
      act(() => usePushStore.setState({ status }));
      expect(pushRow()).toBeNull();
    }
  });

  it('상태별로 줄에 현재 상태를 보여 준다', async () => {
    await render();
    await act(async () => { bell().click(); });
    act(() => usePushStore.setState({ status: 'off' }));
    expect(pushRow()!.textContent).toContain('꺼짐');
    act(() => usePushStore.setState({ status: 'needs-install' }));
    expect(pushRow()!.textContent).toContain('설치 필요');
  });

  it('줄을 누르면 드롭다운이 닫히고 설정 대화상자가 열린다. 켜진 상태에서는 알림 종류 4개를 보여 준다', async () => {
    await render();
    await act(async () => { bell().click(); });
    act(() => usePushStore.setState({ status: 'on', preferences: PREFS }));

    await act(async () => { pushRow()!.click(); });
    await flush();

    expect(dialog()).not.toBeNull();
    expect(pushRow()).toBeNull();   // 드롭다운은 닫혔다
    const boxes = [...dialog()!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(boxes.map((box) => box.checked)).toEqual([true, true, false, true]);
    expect(dialog()!.textContent).toContain('새 팔로워');
    expect(document.body.contains(dialog())).toBe(true);
    expect(host!.contains(dialog())).toBe(false);   // 헤더 밖(body)에 그려진다
  });

  it('종류 체크를 바꾸면 서버에 저장하고, 시험 알림 결과를 보여 준다', async () => {
    await render();
    await act(async () => { bell().click(); });
    act(() => usePushStore.setState({ status: 'on', preferences: PREFS }));
    await act(async () => { pushRow()!.click(); });
    await flush();

    const likes = dialog()!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[2];
    await act(async () => { likes.click(); });
    expect(api.savePushPreferences).toHaveBeenCalledWith({ ...PREFS, likes: true });

    api.sendTestPush.mockResolvedValue({ devices: 1, delivered: 1 });
    await act(async () => { buttonByText('시험 알림 보내기').click(); });
    await flush();
    expect(dialog()!.textContent).toContain('시험 알림을 보냈어요');
  });

  it('꺼진 상태에서는 켜기 버튼이 보이고, 닫기 버튼으로 닫는다', async () => {
    client.syncThisDevice.mockResolvedValue(false);
    await render();
    await act(async () => { bell().click(); });
    act(() => usePushStore.setState({ status: 'off' }));
    await act(async () => { pushRow()!.click(); });
    await flush();

    expect(buttonByText('이 기기에서 알림 받기')).not.toBeUndefined();
    await act(async () => { (document.querySelector('button[aria-label="닫기"]') as HTMLButtonElement).click(); });
    expect(dialog()).toBeNull();
  });

  it('비로그인이면 아무것도 보이지 않는다', async () => {
    useAuthStore.setState({ isAuthenticated: false });
    await render();
    expect(host!.innerHTML).toBe('');
  });
});
