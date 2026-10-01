import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { UserProfile } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { ProfileEditModal } from './ProfileEditModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const profile = {
  id: 'u1', username: 'tester', email: 't@doro.test', nickname: '테스터', blogTitle: 'tester.log', bio: '소개',
  githubUrl: 'https://github.com/tester', followerCount: 0, followingCount: 0, createdAt: '2026-01-01T00:00:00Z',
} as unknown as UserProfile;

let root: Root | undefined;
let host: HTMLElement | undefined;

function render(props: Partial<{ isOpen: boolean; onClose: () => void; onUpdated: (p: UserProfile) => void }> = {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(createElement(ProfileEditModal, { profile, isOpen: true, onClose: vi.fn(), onUpdated: vi.fn(), ...props })));
}

const inputs = () => [...host!.querySelectorAll('input')] as HTMLInputElement[];
const typeInto = (el: HTMLInputElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const tab = (label: string) => [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === label) as HTMLButtonElement;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
});

describe('ProfileEditModal', () => {
  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    render({ isOpen: false });
    expect(host!.innerHTML).toBe('');
  });

  it('기본 정보 탭에 현재 프로필 값이 채워지고 서버 한도와 같은 maxLength 가 걸려 있다', () => {
    render();
    const [nickname, blogTitle, bio, image] = inputs();
    expect(nickname!.value).toBe('테스터');
    expect(blogTitle!.value).toBe('tester.log');
    expect(bio!.value).toBe('소개');
    expect([nickname!.maxLength, blogTitle!.maxLength, bio!.maxLength, image!.maxLength]).toEqual([50, 100, 255, 500]);
  });

  it('소셜 탭과 소개 탭으로 전환된다', () => {
    render();
    act(() => tab('소셜 & 링크').click());
    expect(inputs().some((i) => i.value === 'https://github.com/tester')).toBe(true);
    expect(inputs().find((i) => i.type === 'email')!.maxLength).toBe(100);

    act(() => tab('상세 소개 (About)').click());
    expect(host!.querySelector('textarea')).not.toBeNull();
  });

  it('저장하면 수정한 값으로 API 를 호출하고 스토어/부모에 알린 뒤 닫는다', async () => {
    const updated = { ...profile, nickname: '새 닉네임' } as UserProfile;
    const update = vi.spyOn(blogApi, 'updateMyProfile').mockResolvedValue(updated);
    const setUser = vi.fn();
    useAuthStore.setState({ setUser });
    const onUpdated = vi.fn();
    const onClose = vi.fn();
    render({ onUpdated, onClose });

    typeInto(inputs()[0]!, '새 닉네임');
    await act(async () => { (host!.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await flush();

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ nickname: '새 닉네임', blogTitle: 'tester.log', bio: '소개' }));
    expect(setUser).toHaveBeenCalledWith(updated);
    expect(onUpdated).toHaveBeenCalledWith(updated);
    expect(onClose).toHaveBeenCalled();
  });

  it('저장 실패 시 서버 메시지를 보여주고 닫지 않는다', async () => {
    vi.spyOn(blogApi, 'updateMyProfile').mockRejectedValue(new Error('GitHub 주소는 http(s) 주소여야 합니다.'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onClose = vi.fn();
    render({ onClose });

    await act(async () => { (host!.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await flush();

    expect(host!.textContent).toContain('GitHub 주소는 http(s) 주소여야 합니다.');
    expect(onClose).not.toHaveBeenCalled();
  });
});
