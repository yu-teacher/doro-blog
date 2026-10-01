import { describe, expect, it } from 'vitest';
import { suggestPublishDefaults } from './publishDefaults';

const empty = { slug: '', summary: '', thumbnailUrl: '' };

describe('suggestPublishDefaults', () => {
  it('비어 있는 항목을 제목/본문에서 채운다', () => {
    const d = suggestPublishDefaults('Docker 입문 가이드', '## 시작\n![스샷](https://x.test/a.png)\n본문 내용입니다', empty);
    expect(d.slug).toBe('docker-입문-가이드');
    expect(d.summary).toContain('본문 내용입니다');
    expect(d.summary).not.toContain('##');
    expect(d.thumbnailUrl).toBe('https://x.test/a.png');
    expect(d.thumbnailAutoDetected).toBe(true);
  });

  it('사용자가 채운 값은 덮어쓰지 않는다', () => {
    const d = suggestPublishDefaults('제목', '![a](https://x.test/a.png) 본문', { slug: 'my-slug', summary: '내 요약', thumbnailUrl: '/media/own.png' });
    expect(d).toEqual({ slug: 'my-slug', summary: '내 요약', thumbnailUrl: '/media/own.png', thumbnailAutoDetected: false });
  });

  it('이미지가 없으면 썸네일은 비우고 자동 선택 표시도 끈다', () => {
    const d = suggestPublishDefaults('제목', '이미지 없는 본문', empty);
    expect(d.thumbnailUrl).toBe('');
    expect(d.thumbnailAutoDetected).toBe(false);
  });

  it('제목이 기호뿐이면 기본 슬러그를 쓰고, 요약은 120자로 자른다', () => {
    const d = suggestPublishDefaults('!!!', '가'.repeat(300), empty);
    expect(d.slug).toBe('post');
    expect(d.summary).toHaveLength(120);
  });
});
