import { describe, expect, it } from 'vitest';
import { describeNotification } from './notifications';

describe('[알려진 버그] 알림 종류', () => {
  it('서버가 새 알림 종류(MENTION 등)를 보내도 화면이 깨지지 않도록 일반 문구를 돌려준다', () => {
    const text = describeNotification({ type: 'MENTION' as never, targetPostTitle: '제목' });

    expect(text.suffix).toBeTypeOf('string');
  });
});
