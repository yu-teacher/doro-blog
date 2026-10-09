import { afterEach, describe, expect, it } from 'vitest';
import { buildHeatmapGrid } from './heatmap';

const originalTz = process.env.TZ;

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('활동 잔디밭 격자', () => {
  it('모든 칸의 요일 위치가 그 칸의 날짜와 맞는다 (시간대와 무관하게)', () => {
    for (const tz of ['UTC', 'Asia/Seoul', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
      process.env.TZ = tz;
      // 한국 시간으로는 10월 8일 새벽(00:30)이라 UTC 로는 아직 10월 7일이다
      const grid = buildHeatmapGrid([], new Date('2026-10-08T00:30:00+09:00'));

      for (const week of grid.weeks) {
        week.forEach((cell, weekdayIndex) => {
          if (!cell.date) return;
          const weekday = new Date(`${cell.date}T00:00:00Z`).getUTCDay();
          expect(weekday, `${tz} ${cell.date}`).toBe(weekdayIndex);
        });
      }
    }
  });

  it('마지막 칸은 기준 시각이 속한 날(UTC 기준 서버 날짜와 같은 규칙)이고, 365일을 채운다', () => {
    process.env.TZ = 'Asia/Seoul';
    const grid = buildHeatmapGrid([], new Date('2026-10-08T00:30:00+09:00'));
    const dated = grid.weeks.flat().filter((c) => c.date);

    expect(dated).toHaveLength(365);
    expect(dated.at(-1)?.date).toBe('2026-10-07');
    expect(dated[0].date).toBe('2025-10-08');
  });

  it('서버가 준 날짜별 개수를 같은 날짜 칸에 넣고 총합을 센다', () => {
    const grid = buildHeatmapGrid([{ date: '2026-10-07', count: 3 }, { date: '2026-09-01', count: 2 }], new Date('2026-10-08T12:00:00Z'));
    const byDate = new Map(grid.weeks.flat().filter((c) => c.date).map((c) => [c.date, c.count]));

    expect(byDate.get('2026-10-07')).toBe(3);
    expect(byDate.get('2026-09-01')).toBe(2);
    expect(byDate.get('2026-10-08')).toBe(0);
    expect(grid.total).toBe(5);
  });

  it('비어 있는 칸(첫 주 앞쪽, 마지막 주 뒤쪽)은 count -1 로 채운다', () => {
    const grid = buildHeatmapGrid([], new Date('2026-10-08T12:00:00Z'));

    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    expect(grid.weeks.flat().filter((c) => c.count === -1).every((c) => c.date === '')).toBe(true);
  });
});
