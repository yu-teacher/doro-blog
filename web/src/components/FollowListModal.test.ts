import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blogApi } from '../api/blogApi';
import type { FollowUser, PageResponse } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { FollowListModal } from './FollowListModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const follower = (n: number): FollowUser => ({ id: `u${n}`, username: `user${n}`, nickname: `닉${n}`, profileImageUrl: null, isFollowing: false }) as unknown as FollowUser;

function pageOf(users: FollowUser[], totalElements = users.length): PageResponse<FollowUser> {
  return { content: users, totalElements, totalPages: 1, size: 50, number: 0, first: true, last: true, empty: users.length === 0 };
}

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderModal(props: { isOpen: boolean; initialTab?: 'followers' | 'following' }) {
  if (!host) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  }
  await act(async () => {
    root!.render(createElement(MemoryRouter, null, createElement(FollowListModal, {
      username: 'writer', initialTab: props.initialTab ?? 'followers', isOpen: props.isOpen, onClose: () => undefined,
    })));
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

const buttonNamed = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

describe('FollowListModal', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null });
  });
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
    vi.restoreAllMocks();
  });

  it('목록을 불러오지 못하면 "아직 팔로워가 없습니다"가 아니라 오류와 다시 시도를 보여 준다', async () => {
    vi.spyOn(blogApi, 'getFollowers').mockRejectedValue(new Error('서버 오류'));
    await renderModal({ isOpen: true });

    expect(document.body.textContent).not.toContain('아직 팔로워가 없습니다');
    expect(document.body.textContent).toContain('불러오지 못했습니다');
    expect(buttonNamed('다시 시도'), '다시 시도 버튼').toBeDefined();
  });

  it('팔로워가 정말 없으면 안내 문구를 보여 준다', async () => {
    vi.spyOn(blogApi, 'getFollowers').mockResolvedValue(pageOf([]));
    await renderModal({ isOpen: true });

    expect(document.body.textContent).toContain('아직 팔로워가 없습니다');
  });

  it('닫았다가 다시 열면 요청한 탭(팔로워)으로 열린다 (이전에 보던 탭이 남아 있지 않다)', async () => {
    const followers = vi.spyOn(blogApi, 'getFollowers').mockResolvedValue(pageOf([follower(1)]));
    const following = vi.spyOn(blogApi, 'getFollowing').mockResolvedValue(pageOf([follower(2)]));
    await renderModal({ isOpen: true, initialTab: 'followers' });
    await act(async () => { buttonNamed('팔로잉').click(); await Promise.resolve(); });
    expect(following).toHaveBeenCalled();

    await renderModal({ isOpen: false, initialTab: 'followers' });
    followers.mockClear();
    following.mockClear();
    await renderModal({ isOpen: true, initialTab: 'followers' });

    expect(followers, '팔로워 탭으로 열려 팔로워 목록을 요청해야 한다').toHaveBeenCalled();
    expect(following).not.toHaveBeenCalled();
  });

  it('전체 인원이 한 번에 보여 주는 수보다 많으면 일부만 보여 준다고 알려 준다', async () => {
    vi.spyOn(blogApi, 'getFollowers').mockResolvedValue(pageOf(Array.from({ length: 50 }, (_, i) => follower(i)), 120));
    await renderModal({ isOpen: true });

    expect(document.body.textContent).toContain('120');
    expect(document.body.textContent).toMatch(/50명/);
  });
});
