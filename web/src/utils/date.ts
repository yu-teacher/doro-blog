/** 화면에 표시하는 날짜/시간 형식. 로케일과 형식을 한 곳에서 정한다. */
const LOCALE = 'ko-KR';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** 이 기간 안의 글/알림은 "N일 전"처럼 상대 시간으로 보여준다. */
const RELATIVE_WINDOW_DAYS = 7;

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

type Format = 'date' | 'dateLong' | 'dateShort' | 'dateTime' | 'dateTimeShort' | 'monthDay' | 'clock';

const OPTIONS: Record<Format, Intl.DateTimeFormatOptions | undefined> = {
  date: undefined, // 2026. 10. 1.
  dateLong: { year: 'numeric', month: 'long', day: 'numeric' },
  dateShort: { year: 'numeric', month: 'short', day: 'numeric' },
  dateTime: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  dateTimeShort: { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  monthDay: { month: 'short', day: 'numeric' },
  clock: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
};

/** 값이 없거나 잘못된 날짜면 fallback 을 돌려준다. */
export function formatDate(value: string | number | Date | null | undefined, format: Format = 'date', fallback = ''): string {
  const date = toDate(value);
  if (!date) return fallback;
  return format === 'clock' ? date.toLocaleTimeString(LOCALE, OPTIONS.clock) : date.toLocaleDateString(LOCALE, OPTIONS[format]);
}

/** 날짜와 시간을 함께 (로케일 기본 형식). */
export function formatDateTime(value: string | number | Date | null | undefined, fallback = ''): string {
  const date = toDate(value);
  return date ? date.toLocaleString(LOCALE) : fallback;
}

/**
 * "방금 전 / N분 전 / N시간 전 / N일 전", 일주일이 지나면 absolute 형식의 날짜.
 * now 는 테스트에서 시간을 고정하기 위한 것이다.
 */
export function formatRelative(
  value: string | number | Date | null | undefined,
  absolute: Format = 'dateShort',
  now: number = Date.now()
): string {
  const date = toDate(value);
  if (!date) return '';
  const diff = now - date.getTime();
  if (diff < MINUTE_MS) return '방금 전';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}분 전`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}시간 전`;
  if (diff < RELATIVE_WINDOW_DAYS * DAY_MS) return `${Math.floor(diff / DAY_MS)}일 전`;
  return formatDate(date, absolute);
}
