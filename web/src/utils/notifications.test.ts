import { describe, expect, it } from 'vitest';
import type { NotificationItem } from '../api/types';
import { describeNotification, notificationLink } from './notifications';

const base = { id: 'n1', isRead: false, createdAt: '2026-01-01T00:00:00Z', sender: { id: 's', username: 'sender', nickname: '보낸이' } } as unknown as NotificationItem;

describe('describeNotification', () => {
  it('종류별 문장을 만든다', () => {
    expect(describeNotification({ type: 'COMMENT', targetPostTitle: '글' })).toEqual({ target: '글', suffix: '에 댓글을 남겼습니다.' });
    expect(describeNotification({ type: 'REPLY', targetPostTitle: '글' }).suffix).toContain('답글');
    expect(describeNotification({ type: 'LIKE', targetPostTitle: '글' }).suffix).toContain('좋아');
    expect(describeNotification({ type: 'FOLLOW' })).toEqual({ target: null, suffix: '회원님을 팔로우하기 시작했습니다.' });
  });
});

describe('notificationLink', () => {
  it('글 알림은 글 주소(대상 작성자 우선), 팔로우는 보낸 사람 채널, 그 외는 null', () => {
    expect(notificationLink({ ...base, type: 'COMMENT', targetPostSlug: 'p', targetUsername: 'owner' })).toBe('/@owner/p');
    expect(notificationLink({ ...base, type: 'LIKE', targetPostSlug: 'p' })).toBe('/@sender/p');
    expect(notificationLink({ ...base, type: 'FOLLOW' })).toBe('/@sender');
    expect(notificationLink({ ...base, type: 'COMMENT' })).toBeNull();
  });
});
