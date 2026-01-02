"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DayActivity } from "@/lib/db/wrapped";
import { AccentHighlight, Highlight, Tagline } from "./shared";

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

function getStreakMessage(longestStreak: number): string {
  if (longestStreak >= 14) return "Impressive dedication.";
  if (longestStreak >= 7) return "A solid week of commitment.";
  return "Every day counts.";
}

export function CalendarHeatmap({
  data,
  year,
  serverId,
  userId,
}: CalendarHeatmapProps) {
  const { weeks, maxValue, monthPositions, activeDays, longestStreak } =
    useMemo(() => {
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
          <div className="flex items-center gap-3 mb-4">
            <CalendarDays className="w-7 h-7 text-blue-400" strokeWidth={1.5} />
            <p className="text-base text-white/50 uppercase tracking-wider">
              Daily activity
            </p>
          </div>
          <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Your Year in Days
          </h3>
          <div className="flex items-start gap-4 mb-8">
            <div className="hidden md:block w-px self-stretch bg-gradient-to-b from-blue-400 to-transparent" />
            <p className="text-xl md:text-2xl text-white/70 max-w-2xl leading-relaxed">
              <Highlight>{activeDays} days</Highlight> with activity, longest
              streak of <AccentHighlight>{longestStreak} days</AccentHighlight>.{" "}
              <Tagline>{getStreakMessage(longestStreak)}</Tagline>
            </p>
          </div>
        </div>

        <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="min-w-[700px]">
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
                gridTemplateColumns: `auto repeat(${weeks.length}, minmax(10px, 1fr))`,
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
          </div>
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
