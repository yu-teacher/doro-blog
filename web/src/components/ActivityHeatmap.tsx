import React, { useMemo, useState } from 'react';
import type { UserActivity } from '../api/types';
import { Calendar } from 'lucide-react';
import { buildHeatmapGrid } from '../utils/heatmap';

interface ActivityHeatmapProps {
  activities: UserActivity[];
  authorNickname: string;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ activities, authorNickname }) => {
  const [hoveredCell, setHoveredCell] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  const { calendarGrid, totalPosts } = useMemo(() => {
    const grid = buildHeatmapGrid(activities, new Date());
    return { calendarGrid: grid.weeks, totalPosts: grid.total };
  }, [activities]);

  const getColorClass = (count: number) => {
    if (count < 0) return 'opacity-0 cursor-default'; // Empty pad
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800/80 hover:ring-1 hover:ring-slate-300 dark:hover:ring-slate-600';
    if (count === 1) return 'bg-emerald-200 dark:bg-emerald-900 hover:ring-2 hover:ring-emerald-400';
    if (count === 2) return 'bg-emerald-400 dark:bg-emerald-700 hover:ring-2 hover:ring-emerald-500';
    if (count === 3) return 'bg-emerald-500 dark:bg-emerald-500 hover:ring-2 hover:ring-emerald-300';
    return 'bg-emerald-600 dark:bg-emerald-400 hover:ring-2 hover:ring-emerald-300';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {authorNickname}님의 활동 잔디밭 (최근 1년)
          </h3>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          총 <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{totalPosts}편</strong>의 글 작성
        </span>
      </div>

      {/* Heatmap Grid - 100% responsive, no horizontal scrollbar */}
      <div className="w-full py-1">
        <div className="flex w-full items-center justify-between gap-[1px] sm:gap-[2px] md:gap-[3px]">
          {calendarGrid.map((week, wIdx) => (
            <div key={wIdx} className="flex-1 flex flex-col gap-[1px] sm:gap-[2px] md:gap-[3px]">
              {week.map((day, dIdx) => (
                <div
                  key={dIdx}
                  onMouseEnter={(e) => {
                    if (day.count >= 0) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredCell({
                        date: day.date,
                        count: day.count,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }
                  }}
                  onMouseLeave={() => setHoveredCell(null)}
                  className={`aspect-square w-full rounded-[2px] transition-all cursor-pointer ${getColorClass(day.count)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4 text-[11px] text-slate-400 dark:text-slate-500">
        <span>Less</span>
        <div className="w-2.5 h-2.5 rounded-xs bg-slate-100 dark:bg-slate-800/80" />
        <div className="w-2.5 h-2.5 rounded-xs bg-emerald-200 dark:bg-emerald-900" />
        <div className="w-2.5 h-2.5 rounded-xs bg-emerald-400 dark:bg-emerald-700" />
        <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500 dark:bg-emerald-500" />
        <div className="w-2.5 h-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-400" />
        <span>More</span>
      </div>

      {/* Floating Tooltip */}
      {hoveredCell && (
        <div
          className="fixed z-50 px-2.5 py-1 text-xs text-white bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full -mt-2 animate-in fade-in zoom-in-95 duration-150"
          style={{ left: hoveredCell.x, top: hoveredCell.y }}
        >
          <div className="font-semibold">{hoveredCell.date}</div>
          <div className="text-slate-300">
            {hoveredCell.count === 0 ? '작성된 글 없음' : `${hoveredCell.count}편의 글 발행`}
          </div>
        </div>
      )}
    </div>
  );
};
