import { describe, expect, it } from 'vitest';
import { moveItem } from './reorder';

describe('moveItem', () => {
  it('앞의 항목을 뒤로 옮긴다', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('뒤의 항목을 앞으로 옮긴다', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('원본 배열은 바꾸지 않는다', () => {
    const original = ['a', 'b', 'c'];
    moveItem(original, 0, 2);
    expect(original).toEqual(['a', 'b', 'c']);
  });

  it('제자리·범위 밖·정수가 아닌 인덱스는 같은 배열을 그대로 돌려준다', () => {
    const list = ['a', 'b', 'c'];
    expect(moveItem(list, 1, 1)).toBe(list);
    expect(moveItem(list, -1, 1)).toBe(list);
    expect(moveItem(list, 0, 3)).toBe(list);
    expect(moveItem(list, 0.5, 1)).toBe(list);
    expect(moveItem([], 0, 0)).toEqual([]);
  });
});
