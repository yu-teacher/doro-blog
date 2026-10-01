import { describe, expect, it } from 'vitest';
import { avatarInitial, countComments } from './commentUtils';

describe('countComments', () => {
  it('댓글과 답글을 모두 센다', () => {
    expect(countComments([])).toBe(0);
    expect(countComments([{ replies: [] }, { replies: undefined }, { replies: [{}, {}] }])).toBe(5);
  });
});

describe('avatarInitial', () => {
  it('첫 글자를 대문자로, 비어 있으면 ?', () => {
    expect(avatarInitial('alice')).toBe('A');
    expect(avatarInitial('  홍길동')).toBe('홍');
    expect(avatarInitial('')).toBe('?');
    expect(avatarInitial(undefined)).toBe('?');
  });
});
