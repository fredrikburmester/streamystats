"use client";

import { Activity } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { WrappedActivityPatterns } from "@/lib/db/wrapped";
import { CalendarHeatmap } from "./CalendarHeatmap";
import { Highlight, Tagline } from "./shared";

type ViewMode = "hours" | "days" | "months";

interface ChartBarProps {
  height: number;
  isPeak: boolean;
  label: string;
  watchTimeSeconds: number;
  index: number;
  delayMultiplier: number;
}

function formatWatchTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

function ChartBar({
  height,
  isPeak,
  label,
  watchTimeSeconds,
  index,
  delayMultiplier,
}: ChartBarProps) {
  return (
    <motion.div
      initial={{ height: 0 }}
      whileInView={{ height: `${Math.max(height, 2)}%` }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: index * delayMultiplier,
        ease: "easeOut",
      }}
      className={`flex-1 rounded-t-sm ${
        isPeak ? "bg-blue-500" : "bg-blue-500/40 hover:bg-blue-500/60"
      } transition-colors cursor-pointer group relative`}
      title={`${label} - ${formatWatchTime(watchTimeSeconds)}`}
    >
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-white/10 backdrop-blur px-2 py-1 rounded text-xs whitespace-nowrap">
        {formatWatchTime(watchTimeSeconds)}
      </div>
    </motion.div>
  );
}

interface ActivityPatternsSectionProps {
  activityPatterns: WrappedActivityPatterns;
  year: number;
  serverId: number;
  userId: string;
}

export function ActivityPatternsSection({
  activityPatterns,
  year,
  serverId,
  userId,
}: ActivityPatternsSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("days");

  const { maxValue, peakLabel, backgroundText, viewModeText, description } =
    useMemo(() => {
      const peakHour = activityPatterns.peakHour;
      let timeOfDayLabel = "evening watcher";
      let timeOfDayTagline = "The work ends, the watch begins.";

      if (peakHour >= 22 || peakHour < 5) {
        timeOfDayLabel = "night owl";
        timeOfDayTagline = "Just one more episode is your love language.";
      } else if (peakHour >= 5 && peakHour < 12) {
        timeOfDayLabel = "morning person";
        timeOfDayTagline = "Starting your day strong!";
      } else if (peakHour >= 12 && peakHour < 17) {
        timeOfDayLabel = "afternoon viewer";
        timeOfDayTagline = "Your break time is screen time.";
      }

      if (viewMode === "hours") {
        const values = activityPatterns.hourlyPatterns.map(
          (d) => d.watchTimeSeconds,
        );
        const max = values.length > 0 ? Math.max(...values) : 0;
        return {
          maxValue: max,
          peakLabel: `${peakHour.toString().padStart(2, "0")}:00`,
          backgroundText: "HOURS",
          viewModeText: "was your peak",
          description: {
            highlight: timeOfDayLabel,
            text: ".",
            tagline: timeOfDayTagline,
          },
        };
      }
      if (viewMode === "days") {
        const values = activityPatterns.weekdayPatterns.map(
          (d) => d.watchTimeSeconds,
        );
        const max = values.length > 0 ? Math.max(...values) : 0;
        return {
          maxValue: max,
          peakLabel: activityPatterns.peakWeekday,
          backgroundText: "DAYS",
          viewModeText: "took the crown",
          description: {
            highlight: "Weekends or weekdays",
            text: ", you have your rhythm.",
            tagline: "Your favorite day to unwind.",
          },
        };
      }
      const values = activityPatterns.monthlyTotals.map(
        (d) => d.watchTimeSeconds,
      );
      const max = values.length > 0 ? Math.max(...values) : 0;
      const peakMonth = activityPatterns.monthlyTotals.find(
        (m) => m.month === activityPatterns.peakMonth,
      );
      const monthName = peakMonth?.monthName ?? "Unknown";
      return {
        maxValue: max,
        peakLabel: monthName,
        backgroundText: "MONTHS",
        viewModeText: "was your biggest month",
        description: {
          highlight: "It really had you committed.",
          text: "",
          tagline: "When the screen called, you answered.",
        },
      };
    }, [viewMode, activityPatterns]);

  const tabs = [
    { key: "hours" as const, label: "HOURS" },
    { key: "days" as const, label: "DAYS" },
    { key: "months" as const, label: "MONTHS" },
  ];
  return (
    <section className="relative py-28 px-4 md:px-8 overflow-hidden">
      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-7 h-7 text-blue-400" strokeWidth={1.5} />
                <p className="text-base text-white/50 uppercase tracking-wider">
                  Activity patterns
                </p>
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                <span className="text-blue-400">{peakLabel}</span>{" "}
                <span className="text-white/80">{viewModeText}</span>
              </h2>
            </div>

            <div className="flex gap-1 bg-white/5 p-1 rounded-full w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setViewMode(tab.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                    viewMode === tab.key
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white/70"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="hidden md:block w-px self-stretch bg-gradient-to-b from-blue-400 to-transparent" />
            <p className="text-xl md:text-2xl text-white/70 max-w-2xl leading-relaxed">
              {viewMode === "hours" ? "You're a " : ""}
              <Highlight>{description.highlight}</Highlight>
              {description.text} <Tagline>{description.tagline}</Tagline>
            </p>
          </div>
        </motion.div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.03 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="text-[10rem] md:text-[16rem] font-black text-white uppercase tracking-tighter"
            >
              {backgroundText}
            </motion.span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-white/40">
              <span>{formatWatchTime(maxValue)}</span>
              <span>{formatWatchTime(Math.round(maxValue / 2))}</span>
              <span>0</span>
            </div>

            <div className="ml-14 h-64 flex items-end gap-1">
              {viewMode === "hours" &&
                activityPatterns.hourlyPatterns.map((item, index) => (
                  <ChartBar
                    key={item.hour}
                    height={
                      maxValue > 0
                        ? (item.watchTimeSeconds / maxValue) * 100
                        : 0
                    }
                    isPeak={item.hour === activityPatterns.peakHour}
                    label={`${item.hour}:00`}
                    watchTimeSeconds={item.watchTimeSeconds}
                    index={index}
                    delayMultiplier={0.02}
                  />
                ))}
              {viewMode === "days" &&
                activityPatterns.weekdayPatterns.map((item, index) => (
                  <ChartBar
                    key={item.day}
                    height={
                      maxValue > 0
                        ? (item.watchTimeSeconds / maxValue) * 100
                        : 0
                    }
                    isPeak={item.day === activityPatterns.peakWeekday}
                    label={item.day}
                    watchTimeSeconds={item.watchTimeSeconds}
                    index={index}
                    delayMultiplier={0.05}
                  />
                ))}
              {viewMode === "months" &&
                activityPatterns.monthlyTotals.map((item, index) => (
                  <ChartBar
                    key={item.month}
                    height={
                      maxValue > 0
                        ? (item.watchTimeSeconds / maxValue) * 100
                        : 0
                    }
                    isPeak={item.month === activityPatterns.peakMonth}
                    label={item.monthName}
                    watchTimeSeconds={item.watchTimeSeconds}
                    index={index}
                    delayMultiplier={0.05}
                  />
                ))}
            </div>

            <div className="ml-14 flex gap-1 mt-2">
              {viewMode === "hours" &&
                activityPatterns.hourlyPatterns.map((item) => (
                  <div
                    key={item.hour}
                    className="flex-1 text-center text-[10px] text-white/40"
                  >
                    {item.hour % 3 === 0 ? item.hour : ""}
                  </div>
                ))}
              {viewMode === "days" &&
                activityPatterns.weekdayPatterns.map((item) => (
                  <div
                    key={item.day}
                    className="flex-1 text-center text-xs text-white/40"
                  >
                    {item.day.slice(0, 3)}
                  </div>
                ))}
              {viewMode === "months" &&
                activityPatterns.monthlyTotals.map((item) => (
                  <div
                    key={item.month}
                    className="flex-1 text-center text-[10px] text-white/40"
                  >
                    {item.monthName.slice(0, 3)}
                  </div>
                ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 pt-16 border-t border-white/10"
        >
          <CalendarHeatmap
            data={activityPatterns.calendarHeatmap}
            year={year}
            serverId={serverId}
            userId={userId}
            longestStreak={activityPatterns.longestStreak}
          />
        </motion.div>
      </div>
    </section>
  );
}
