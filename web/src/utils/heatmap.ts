export interface HeatmapActivity {
  date: string;
  count: number;
}

export interface HeatmapCell {
  /** YYYY-MM-DD (UTC). 빈 칸이면 ''. */
  date: string;
  /** 그날 쓴 글 수. 빈 칸이면 -1. */
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_SHOWN = 365;
const WEEK = 7;

/**
 * 최근 365일을 주(일요일 시작) 단위 열로 나눈 격자를 만든다.
 * 서버는 날짜를 UTC 기준 YYYY-MM-DD 로 주므로 날짜 문자열과 요일 모두 UTC 로 계산한다.
 * (날짜는 UTC, 요일은 로컬로 섞으면 한국처럼 UTC 보다 앞선 시간대에서 새벽 시간에 칸이 하루씩 어긋난다.)
 */
export function buildHeatmapGrid(activities: HeatmapActivity[], now: Date): { weeks: HeatmapCell[][]; total: number } {
  const counts = new Map<string, number>();
  let total = 0;
  for (const a of activities) {
    counts.set(a.date, a.count);
    total += a.count;
  }

  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days: { date: string; count: number; weekday: number }[] = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
    const day = new Date(todayUtc - i * DAY_MS);
    const date = day.toISOString().slice(0, 10);
    days.push({ date, count: counts.get(date) ?? 0, weekday: day.getUTCDay() });
  }

  const weeks: HeatmapCell[][] = [];
  let week: HeatmapCell[] = [];
  for (let i = 0; i < days[0].weekday; i++) {
    week.push({ date: '', count: -1 });
  }
  for (const day of days) {
    week.push({ date: day.date, count: day.count });
    if (week.length === WEEK) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < WEEK) {
      week.push({ date: '', count: -1 });
    }
    weeks.push(week);
  }
  return { weeks, total };
}
