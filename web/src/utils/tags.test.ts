import { describe, expect, it } from 'vitest';
import { countTags, deriveFeedTags } from './tags';

const post = (...tags: string[]) => ({ tags });

describe('countTags', () => {
  it('많은 순, 같으면 이름 순으로 센다', () => {
    expect(countTags([post('b', 'a'), post('a'), post('c', 'b', 'a')])).toEqual([
      { name: 'a', count: 3 },
      { name: 'b', count: 2 },
      { name: 'c', count: 1 },
    ]);
  });

  it('공백/빈 태그와 tags 가 없는 글을 무시한다', () => {
    expect(countTags([{ tags: ['  x  ', '', '  '] }, { tags: null }, {}])).toEqual([{ name: 'x', count: 1 }]);
  });

  it('lowercase 는 대소문자를 합치고, exclude 와 limit 를 적용한다', () => {
    const posts = [post('Java', 'Spring'), post('java'), post('JAVA', 'docker')];
    expect(countTags(posts, { lowercase: true, exclude: ['spring'], limit: 1 })).toEqual([{ name: 'java', count: 3 }]);
  });
});

describe('deriveFeedTags', () => {
  const global = [{ id: 'g1', name: 'global', postCount: 9 }];

  it('글이 있으면 글에 쓰인 태그를 쓴다', () => {
    expect(deriveFeedTags([post('x'), post('x', 'y')], global, 'trending')).toEqual([
      { id: 'x', name: 'x', postCount: 2 },
      { id: 'y', name: 'y', postCount: 1 },
    ]);
  });

  it('글이 없거나 태그가 없으면 전체 인기 태그로 대신한다', () => {
    expect(deriveFeedTags([], global, 'trending')).toEqual(global);
    expect(deriveFeedTags([post()], global, 'latest')).toEqual(global);
  });

  it('구독/좋아요 탭은 글이 없을 때 엉뚱한 인기 태그를 보여주지 않는다', () => {
    expect(deriveFeedTags([], global, 'feed')).toEqual([]);
    expect(deriveFeedTags([post()], global, 'likes')).toEqual([]);
  });
});
