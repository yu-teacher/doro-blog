import type { NotificationItem } from '../api/types';

export interface NotificationText {
  /** 문장 중간에 강조해서 보여줄 글 제목 (없으면 null). */
  target: string | null;
  /** "님이" 뒤에 이어지는 문장 (target 이 있으면 target 다음에 붙는다). */
  suffix: string;
}

/** 알림 종류별 한 줄 설명. */
export function describeNotification(item: Pick<NotificationItem, 'type' | 'targetPostTitle'>): NotificationText {
  const title = item.targetPostTitle ?? '';
  switch (item.type) {
    case 'COMMENT':
      return { target: title, suffix: '에 댓글을 남겼습니다.' };
    case 'REPLY':
      return { target: title, suffix: '의 댓글에 답글을 남겼습니다.' };
    case 'LIKE':
      return { target: title, suffix: '글을 좋아합니다.' };
    case 'FOLLOW':
      return { target: null, suffix: '회원님을 팔로우하기 시작했습니다.' };
  }
}

/** 알림을 눌렀을 때 이동할 주소 (이동할 곳이 없으면 null). */
export function notificationLink(item: NotificationItem): string | null {
  if (item.targetPostSlug) {
    const username = item.targetUsername || item.sender.username;
    return `/@${username}/${item.targetPostSlug}`;
  }
  if (item.type === 'FOLLOW') return `/@${item.sender.username}`;
  return null;
}
