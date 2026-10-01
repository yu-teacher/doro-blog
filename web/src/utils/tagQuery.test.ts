import { describe, expect, it } from 'vitest';
import { addSelectedTag, buildTagSearchParams, parseSelectedTags, removeSelectedTag } from './tagQuery';

describe('parseSelectedTags', () => {
  it('tag 와 tags 파라미터를 합쳐 소문자/중복 제거/정렬한다', () => {
    expect(parseSelectedTags(new URLSearchParams('tag=Spring&tag=docker&tags=Docker, React ,'))).toEqual(['docker', 'react', 'spring']);
  });

  it('없으면 빈 목록', () => {
    expect(parseSelectedTags(new URLSearchParams(''))).toEqual([]);
    expect(parseSelectedTags(new URLSearchParams('tags='))).toEqual([]);
  });
});

describe('buildTagSearchParams', () => {
  it('태그와 기본이 아닌 정렬만 담는다', () => {
    expect(buildTagSearchParams(['a', 'b'], 'popular').toString()).toBe('tags=a%2Cb&sort=popular');
    expect(buildTagSearchParams(['a'], 'latest').toString()).toBe('tags=a');
    expect(buildTagSearchParams([], 'latest').toString()).toBe('');
  });
});

describe('addSelectedTag / removeSelectedTag', () => {
  it('추가는 대소문자를 무시해 중복을 막는다 (예전에는 Spring 과 spring 이 둘 다 들어갔다)', () => {
    expect(addSelectedTag(['spring'], 'Spring')).toEqual(['spring']);
    expect(addSelectedTag(['spring'], ' Docker ')).toEqual(['spring', 'docker']);
    expect(addSelectedTag(['spring'], '   ')).toEqual(['spring']);
  });

  it('삭제는 대소문자를 무시한다', () => {
    expect(removeSelectedTag(['spring', 'docker'], 'SPRING')).toEqual(['docker']);
  });
});
