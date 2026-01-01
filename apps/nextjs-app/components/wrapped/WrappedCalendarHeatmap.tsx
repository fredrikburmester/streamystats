"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import type { DayActivity } from "@/lib/db/wrapped";
import { cn } from "@/lib/utils";

interface WrappedCalendarHeatmapProps {
  data: DayActivity[];
  year: number;
  serverId: number;
  userId: string;
}

export function WrappedCalendarHeatmap({
  data,
  year,
  serverId,
  userId,
}: WrappedCalendarHeatmapProps) {
  const { weeks, maxValue, monthPositions } = useMemo(() => {
    const dataMap = new Map(data.map((d) => [d.date, d.watchTimeSeconds]));

    // Generate all days of the year using local time consistently
    const formatDate = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    // Monday = 0, Sunday = 6
    const getMondayBasedDay = (d: Date): number => (d.getDay() + 6) % 7;

    type DaySlot = { date: string; value: number } | null;
    const weeks: Array<Array<DaySlot>> = [];
    let currentWeek: Array<DaySlot> = Array(7).fill(null);

    const current = new Date(year, 0, 1); // January 1 in local time
    while (current.getFullYear() === year) {
      const dateStr = formatDate(current);
      const dayOfWeek = getMondayBasedDay(current);

      // If it's Monday and we have data in current week, start a new week
      if (dayOfWeek === 0 && currentWeek.some((d) => d !== null)) {
        weeks.push(currentWeek);
        currentWeek = Array(7).fill(null);
      }

      currentWeek[dayOfWeek] = {
        date: dateStr,
        value: dataMap.get(dateStr) ?? 0,
      };

      current.setDate(current.getDate() + 1);
    }

    // Push the final week
    if (currentWeek.some((d) => d !== null)) {
      weeks.push(currentWeek);
    }

    // Calculate firstDayOfWeek for month position calculation
    const firstDayOfWeek = getMondayBasedDay(new Date(year, 0, 1));

    const allValues = weeks.flatMap((week) =>
      week
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map((d) => d.value),
    );
    const maxValue = Math.max(...allValues, 1);

    // Calculate month start positions (which week each month starts in)
    const monthPositions: Array<{ month: string; weekIndex: number }> = [];
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

    for (let m = 0; m < 12; m++) {
      const firstOfMonth = new Date(year, m, 1);
      const startOfYear = new Date(year, 0, 1);
      const dayOfYear = Math.floor(
        (firstOfMonth.getTime() - startOfYear.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const weekIndex = Math.floor((dayOfYear + firstDayOfWeek) / 7);
      monthPositions.push({ month: months[m], weekIndex });
    }

    return { weeks, maxValue, monthPositions };
  }, [data, year]);

  const getIntensityClass = (value: number): string => {
    if (value < 0) return "bg-transparent";
    if (value === 0) return "bg-muted/50";
    const intensity = value / maxValue;
    if (intensity < 0.25) return "bg-foreground/25";
    if (intensity < 0.5) return "bg-foreground/40";
    if (intensity < 0.75) return "bg-foreground/60";
    return "bg-foreground/80";
  };

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="w-full">
      {/* Month labels row */}
      <div className="flex">
        <div className="w-8 shrink-0" /> {/* Space for day labels */}
        <div className="flex-1 relative h-4 mb-[2px]">
          {monthPositions.map(({ month, weekIndex }, i) => (
            <span
              key={month}
              className="absolute text-[10px] text-muted-foreground"
              style={{
                left: `${(weekIndex / weeks.length) * 100}%`,
              }}
            >
              {month}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar grid with day labels */}
      <div
        className="grid gap-[2px]"
        style={{
          gridTemplateColumns: `auto repeat(${weeks.length}, 1fr)`,
          gridTemplateRows: "repeat(7, 1fr)",
        }}
      >
        {/* Render row by row: day label + all cells for that day */}
        {dayLabels.map((dayLabel, dayIndex) => (
          <Fragment key={dayIndex}>
            <div className="text-[10px] text-muted-foreground pr-2 flex items-center">
              {dayLabel}
            </div>
            {weeks.map((week, weekIndex) => {
              const day = week[dayIndex];
              if (!day) {
                return (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className="aspect-square rounded-[2px] bg-transparent"
                  />
                );
              }
              return (
                <Link
                  key={`${weekIndex}-${dayIndex}`}
                  href={`/servers/${serverId}/history?startDate=${day.date}&endDate=${day.date}&userId=${userId}`}
                  className={cn(
                    "aspect-square rounded-[2px] transition-opacity hover:opacity-80",
                    getIntensityClass(day.value),
                  )}
                  title={`${day.date}: ${Math.round(day.value / 60)} minutes`}
                />
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-[2px]">
          <div className="w-[10px] h-[10px] rounded-[2px] bg-muted/50" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-foreground/25" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-foreground/40" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-foreground/60" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-foreground/80" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
