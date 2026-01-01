"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DayActivity } from "@/lib/db/wrapped";

interface WrappedCalendarHeatmapProps {
  data: DayActivity[];
  year: number;
}

export function WrappedCalendarHeatmap({
  data,
  year,
}: WrappedCalendarHeatmapProps) {
  const { weeks, maxValue } = useMemo(() => {
    // Create a map for quick lookup
    const dataMap = new Map(data.map((d) => [d.date, d.watchTimeSeconds]));

    // Generate all days of the year
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);
    const allDays: Array<{ date: string; value: number }> = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0];
      allDays.push({
        date: dateStr,
        value: dataMap.get(dateStr) ?? 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Group by week
    const weeks: Array<Array<{ date: string; value: number; dayOfWeek: number }>> = [];
    let currentWeek: Array<{ date: string; value: number; dayOfWeek: number }> = [];

    // Add empty cells for days before the first day of the year
    const firstDayOfWeek = new Date(`${year}-01-01`).getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ date: "", value: -1, dayOfWeek: i });
    }

    for (const day of allDays) {
      const dayOfWeek = new Date(day.date).getDay();
      currentWeek.push({ ...day, dayOfWeek });

      if (dayOfWeek === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Add remaining days
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    // Find max value for color scaling
    const maxValue = Math.max(...allDays.map((d) => d.value), 1);

    return { weeks, maxValue };
  }, [data, year]);

  const getIntensityClass = (value: number): string => {
    if (value < 0) return "bg-transparent"; // Empty cell
    if (value === 0) return "bg-white/10";
    const intensity = value / maxValue;
    if (intensity < 0.25) return "bg-emerald-500/40";
    if (intensity < 0.5) return "bg-emerald-500/60";
    if (intensity < 0.75) return "bg-emerald-500/80";
    return "bg-emerald-400";
  };

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return (
    <div className="w-full overflow-x-auto">
      {/* Month labels */}
      <div className="flex gap-[3px] mb-1 text-xs text-white/60 pl-8">
        {months.map((month, i) => (
          <div key={month} className="flex-1 min-w-0" style={{ minWidth: "30px" }}>
            {i % 2 === 0 ? month : ""}
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] text-xs text-white/60 pr-1">
          <div className="h-3" />
          <div className="h-3">Mon</div>
          <div className="h-3" />
          <div className="h-3">Wed</div>
          <div className="h-3" />
          <div className="h-3">Fri</div>
          <div className="h-3" />
        </div>

        {/* Calendar grid */}
        <div className="flex gap-[3px]">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {week.map((day, dayIndex) => (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={cn(
                    "w-3 h-3 rounded-sm",
                    getIntensityClass(day.value)
                  )}
                  title={
                    day.date
                      ? `${day.date}: ${Math.round(day.value / 60)} minutes`
                      : ""
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-3 text-xs text-white/60">
        <span>Less</span>
        <div className="flex gap-[3px]">
          <div className="w-3 h-3 rounded-sm bg-white/10" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500/40" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500/60" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500/80" />
          <div className="w-3 h-3 rounded-sm bg-emerald-400" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
