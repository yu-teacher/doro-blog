import { act, createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModalShell, nextFocusTarget } from './ModalShell';
import { ProfileEditModal } from './ProfileEditModal';
import type { UserProfile } from '../api/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLElement | undefined;

function mount(node: ReturnType<typeof createElement>) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
}

const pressEscape = () => act(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  document.body.innerHTML = '';
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('ModalShell', () => {
  const shell = (onClose: () => void, extra: Record<string, unknown> = {}) =>
    createElement(ModalShell, {
      onClose,
      labelledBy: 't',
      overlayClassName: 'o',
      panelClassName: 'p',
      ...extra,
      children: createElement(
        Fragment,
        null,
        createElement('h2', { id: 't' }, '제목'),
        createElement('button', { id: 'first-btn' }, '버튼'),
        createElement('input', { id: 'first-input' }),
      ),
    });

  it('role=dialog, aria-modal, aria-labelledby 를 갖는다', () => {
    mount(shell(vi.fn()));
    const dialog = host!.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('t');
  });

  it('열리면 첫 입력칸으로 포커스가 이동한다', () => {
    mount(shell(vi.fn()));
    expect(document.activeElement?.id).toBe('first-input');
  });

  it('Esc 로 닫는다', () => {
    const onClose = vi.fn();
    mount(shell(onClose));
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('닫히면(언마운트) 이전 포커스 위치로 돌아가고 Esc 리스너도 제거된다', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    mount(shell(onClose));
    act(() => root!.unmount());
    root = undefined;
    expect(document.activeElement).toBe(opener);
    pressEscape();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('바깥 영역 클릭으로 닫히고, closeOnOverlayClick=false 면 닫히지 않는다', () => {
    const onClose = vi.fn();
    mount(shell(onClose));
    act(() => (host!.firstElementChild as HTMLElement).click());
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => (host!.querySelector('[role="dialog"]') as HTMLElement).click());
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => root!.unmount());
    const onClose2 = vi.fn();
    mount(shell(onClose2, { closeOnOverlayClick: false }));
    act(() => (host!.firstElementChild as HTMLElement).click());
    expect(onClose2).not.toHaveBeenCalled();
  });
});

describe('모달 접근성 적용', () => {
  it('ProfileEditModal: 제목 연결, 닫기 버튼 aria-label, TextField 라벨 연결', () => {
    const profile = {
      id: 'u1', username: 'tester', nickname: '테스터', blogTitle: 'tester.log', followerCount: 0, followingCount: 0, createdAt: '2026-01-01T00:00:00Z',
    } as unknown as UserProfile;
    const onClose = vi.fn();
    mount(createElement(ProfileEditModal, { profile, isOpen: true, onClose, onUpdated: vi.fn() }));
    const dialog = host!.querySelector('[role="dialog"]')!;
    expect(host!.querySelector(`#${dialog.getAttribute('aria-labelledby')}`)?.textContent).toContain('프로필');
    expect(host!.querySelector('button[aria-label="닫기"]')).not.toBeNull();
    const first = host!.querySelector('input')!;
    expect(host!.querySelector(`label[for="${first.id}"]`)?.textContent).toBe('닉네임');
    pressEscape();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('포커스 트랩 (Tab 이 대화상자 밖으로 새지 않는다)', () => {
  const pressTab = (shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    act(() => {
      document.dispatchEvent(event);
    });
    return event;
  };

  const makeButtons = (n: number) => Array.from({ length: n }, () => document.createElement('button'));

  it('nextFocusTarget: 마지막에서 Tab 은 처음으로, 처음에서 Shift+Tab 은 마지막으로 순환한다', () => {
    const [a, b, c] = makeButtons(3);
    expect(nextFocusTarget([a, b, c], c, false)).toBe(a);
    expect(nextFocusTarget([a, b, c], a, true)).toBe(c);
  });

  it('nextFocusTarget: 중간 요소에서는 브라우저의 기본 이동에 맡긴다(null)', () => {
    const [a, b, c] = makeButtons(3);
    expect(nextFocusTarget([a, b, c], b, false)).toBeNull();
    expect(nextFocusTarget([a, b, c], b, true)).toBeNull();
  });

  it('nextFocusTarget: 포커스가 밖에 있으면 안으로 끌어오고, 포커스할 요소가 없으면 null', () => {
    const [a, , c] = makeButtons(3);
    const outside = document.createElement('button');
    expect(nextFocusTarget([a, c], outside, false)).toBe(a);
    expect(nextFocusTarget([a, c], outside, true)).toBe(c);
    expect(nextFocusTarget([], outside, false)).toBeNull();
  });

  it('대화상자 마지막 요소에서 Tab 을 누르면 첫 요소로 돌아간다', () => {
    mount(createElement(ModalShell, {
      onClose: vi.fn(), ariaLabel: '테스트', overlayClassName: 'o', panelClassName: 'p',
      children: createElement(Fragment, null,
        createElement('button', { id: 'a' }, 'a'),
        createElement('button', { id: 'b' }, 'b')),
    }));
    host!.querySelector<HTMLElement>('#b')!.focus();

    const event = pressTab(false);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('a');
  });

  it('첫 요소에서 Shift+Tab 은 마지막 요소로 간다', () => {
    mount(createElement(ModalShell, {
      onClose: vi.fn(), ariaLabel: '테스트', overlayClassName: 'o', panelClassName: 'p',
      children: createElement(Fragment, null,
        createElement('button', { id: 'a' }, 'a'),
        createElement('button', { id: 'b' }, 'b')),
    }));
    host!.querySelector<HTMLElement>('#a')!.focus();

    pressTab(true);

    expect(document.activeElement?.id).toBe('b');
  });
});
