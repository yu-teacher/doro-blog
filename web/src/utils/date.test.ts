import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatRelative } from './date';

const NOW = new Date('2026-10-10T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatRelative', () => {
  it.each([
    [30_000, '방금 전'],
    [5 * MIN, '5분 전'],
    [59 * MIN, '59분 전'],
    [3 * HOUR, '3시간 전'],
    [23 * HOUR, '23시간 전'],
    [2 * DAY, '2일 전'],
    [6 * DAY, '6일 전'],
  ])('%i ms 전 → %s', (diff, expected) => {
    expect(formatRelative(ago(diff), 'dateShort', NOW)).toBe(expected);
  });

  it('일주일이 지나면 절대 날짜로 표시한다', () => {
    expect(formatRelative(ago(8 * DAY), 'dateShort', NOW)).toMatch(/2026/);
    expect(formatRelative(ago(8 * DAY), 'monthDay', NOW)).not.toMatch(/2026/);
  });

  it('잘못된 값은 빈 문자열', () => {
    expect(formatRelative(undefined)).toBe('');
    expect(formatRelative('not-a-date')).toBe('');
  });
});

describe('formatDate', () => {
  it('형식별로 표시한다', () => {
    const iso = '2026-03-05T09:07:00Z';
    expect(formatDate(iso, 'dateLong')).toContain('2026');
    expect(formatDate(iso, 'dateTime')).toMatch(/\d{1,2}:\d{2}|\d{2}:\d{2}/);
    expect(formatDate(iso, 'monthDay')).not.toContain('2026');
    expect(formatDate(iso, 'clock')).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('값이 없거나 잘못되면 fallback', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined, 'date', '-')).toBe('-');
    expect(formatDate('garbage', 'date', '날짜 없음')).toBe('날짜 없음');
  });
});

describe('formatDateTime', () => {
  it('날짜와 시간을 함께 보여주고 잘못된 값은 fallback', () => {
    expect(formatDateTime('2026-03-05T09:07:00Z')).toMatch(/2026/);
    expect(formatDateTime(undefined, '사용 이력 없음')).toBe('사용 이력 없음');
  });
});
