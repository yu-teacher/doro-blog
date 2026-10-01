import { describe, expect, it } from 'vitest';
import { parseSearchInput, searchPath, suggestTags } from './search';

const tags = [
  { id: '1', name: 'Spring', postCount: 9 },
  { id: '2', name: 'springboot', postCount: 5 },
  { id: '3', name: 'react', postCount: 3 },
];

describe('parseSearchInput / searchPath', () => {
  it('#태그 는 태그 검색, 나머지는 본문 검색, 빈 입력은 null', () => {
    expect(parseSearchInput('  #spring ')).toEqual({ kind: 'tag', tag: 'spring' });
    expect(parseSearchInput('docker compose')).toEqual({ kind: 'text', query: 'docker compose' });
    expect(parseSearchInput('#')).toEqual({ kind: 'text', query: '#' });
    expect(parseSearchInput('   ')).toBeNull();
  });

  it('주소는 인코딩한다', () => {
    expect(searchPath({ kind: 'text', query: 'a b&c' })).toBe('/search?q=a%20b%26c');
    expect(searchPath({ kind: 'tag', tag: '스프링' })).toBe(`/tags?tag=${encodeURIComponent('스프링')}`);
  });
});

describe('suggestTags', () => {
  it('대소문자와 앞의 # 를 무시하고 포함 여부로 추천한다', () => {
    expect(suggestTags(tags, '#SPR').map((t) => t.name)).toEqual(['Spring', 'springboot']);
    expect(suggestTags(tags, 'zzz')).toEqual([]);
    expect(suggestTags(tags, '  ')).toEqual([]);
  });

  it('추천 개수를 제한한다', () => {
    expect(suggestTags(tags, 'r', 2)).toHaveLength(2);
  });
});
