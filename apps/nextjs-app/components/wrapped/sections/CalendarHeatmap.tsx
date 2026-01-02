"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DayActivity } from "@/lib/db/wrapped";

interface CalendarHeatmapProps {
  data: DayActivity[];
  year: number;
  serverId: number;
  userId: string;
}

function formatWatchTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) return `${minutes}m`;
  return "No activity";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function CalendarHeatmap({
  data,
  year,
  serverId,
  userId,
}: CalendarHeatmapProps) {
  const {
    weeks,
    maxValue,
    monthPositions,
    totalDays,
    activeDays,
    longestStreak,
  } = useMemo(() => {
    const dataMap = new Map(data.map((d) => [d.date, d.watchTimeSeconds]));

    const formatDateStr = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const getMondayBasedDay = (d: Date): number => (d.getDay() + 6) % 7;

    type DaySlot = { date: string; value: number } | null;
    const weeks: Array<Array<DaySlot>> = [];
    let currentWeek: Array<DaySlot> = Array(7).fill(null);
    let totalDays = 0;
    let activeDays = 0;
    let longestStreak = 0;
    let currentStreak = 0;

    const current = new Date(year, 0, 1);
    while (current.getFullYear() === year) {
      const dateStr = formatDateStr(current);
      const dayOfWeek = getMondayBasedDay(current);

      if (dayOfWeek === 0 && currentWeek.some((d) => d !== null)) {
        weeks.push(currentWeek);
        currentWeek = Array(7).fill(null);
      }

      const value = dataMap.get(dateStr) ?? 0;
      currentWeek[dayOfWeek] = { date: dateStr, value };
      totalDays++;
      if (value > 0) {
        activeDays++;
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }

      current.setDate(current.getDate() + 1);
    }

    if (currentWeek.some((d) => d !== null)) {
      weeks.push(currentWeek);
    }

    const firstDayOfWeek = getMondayBasedDay(new Date(year, 0, 1));

    const allValues = weeks.flatMap((week) =>
      week
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map((d) => d.value),
    );
    const maxValue = Math.max(...allValues, 1);

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

    return {
      weeks,
      maxValue,
      monthPositions,
      totalDays,
      activeDays,
      longestStreak,
    };
  }, [data, year]);

  const getIntensityClass = (value: number): string => {
    if (value < 0) return "bg-transparent";
    if (value === 0) return "bg-white/[0.03]";
    const intensity = value / maxValue;
    if (intensity < 0.25) return "bg-blue-500/25";
    if (intensity < 0.5) return "bg-blue-500/45";
    if (intensity < 0.75) return "bg-blue-500/70";
    return "bg-blue-400";
  };

  const dayLabels = ["M", "", "W", "", "F", "", "S"];

  return (
    <TooltipProvider delayDuration={0} disableHoverableContent>
      <div className="relative">
        <div className="mb-10">
          <p className="text-lg text-white/60 mb-3">Your Watch Streaks</p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-5xl md:text-6xl font-black text-blue-400 tabular-nums">
              {activeDays}
            </span>
            <span className="text-2xl md:text-3xl font-medium text-white/90">
              days watched
            </span>
            <span className="text-white/30 text-2xl md:text-3xl font-light">
              /
            </span>
            <span className="text-5xl md:text-6xl font-black text-blue-400 tabular-nums">
              {longestStreak}
            </span>
            <span className="text-2xl md:text-3xl font-medium text-white/90">
              day streak
            </span>
          </div>
        </div>

        <div className="flex mb-1">
          <div className="w-6 shrink-0" />
          <div className="flex-1 relative h-5">
            {monthPositions.map(({ month, weekIndex }) => (
              <span
                key={month}
                className="absolute text-[11px] text-white/40 font-medium tracking-wide"
                style={{
                  left: `${(weekIndex / weeks.length) * 100}%`,
                }}
              >
                {month}
              </span>
            ))}
          </div>
        </div>

        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: `auto repeat(${weeks.length}, 1fr)`,
            gridTemplateRows: "repeat(7, 1fr)",
          }}
        >
          {dayLabels.map((dayLabel, dayIndex) => (
            <Fragment key={dayIndex}>
              <div className="text-[10px] text-white/30 pr-1.5 flex items-center justify-end font-medium w-6">
                {dayLabel}
              </div>
              {weeks.map((week, weekIndex) => {
                const day = week[dayIndex];
                if (!day) {
                  return (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className="aspect-square rounded-[3px] bg-transparent"
                    />
                  );
                }
                return (
                  <Tooltip key={`${weekIndex}-${dayIndex}`}>
                    <TooltipTrigger asChild>
                      <Link
                        href={`/servers/${serverId}/history?startDate=${day.date}&endDate=${day.date}&userId=${userId}`}
                        className={`aspect-square rounded-[3px] transition-all duration-150 hover:ring-2 hover:ring-blue-400/50 hover:scale-110 ${getIntensityClass(day.value)}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      sideOffset={8}
                      className="text-center"
                    >
                      <p className="text-xs text-muted-foreground">
                        {formatDate(day.date)}
                      </p>
                      <p className="text-sm font-semibold">
                        {formatWatchTime(day.value)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </Fragment>
          ))}
        </div>

        <div className="flex items-center justify-end mt-4">
          <div className="flex items-center gap-2 text-[10px] text-white/40">
            <span>Less</span>
            <div className="flex gap-[3px]">
              <div className="w-[11px] h-[11px] rounded-[3px] bg-white/[0.03]" />
              <div className="w-[11px] h-[11px] rounded-[3px] bg-blue-500/25" />
              <div className="w-[11px] h-[11px] rounded-[3px] bg-blue-500/45" />
              <div className="w-[11px] h-[11px] rounded-[3px] bg-blue-500/70" />
              <div className="w-[11px] h-[11px] rounded-[3px] bg-blue-400" />
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
