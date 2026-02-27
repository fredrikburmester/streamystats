"use client";

import {
  BarChart3,
  Calendar,
  Clock,
  Film,
  Flame,
  Play,
  Repeat,
} from "lucide-react";
import { motion } from "motion/react";
import type {
  RewatchStats,
  TypeBreakdown,
  WrappedActivityPatterns,
  WrappedOverview,
} from "@/lib/db/wrapped";
import { formatDuration } from "@/lib/utils";
import { Highlight, SubsectionHeader, Tagline } from "./shared";

interface YearInNumbersSectionProps {
  year: number;
  overview: WrappedOverview;
  typeBreakdown: TypeBreakdown;
  rewatchStats: RewatchStats;
  activityPatterns: WrappedActivityPatterns;
}

interface StatItemProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  delay: number;
}

function StatItem({ icon, value, label, delay }: StatItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, delay }}
      className="flex items-center gap-4"
    >
      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-blue-400">
        {icon}
      </div>
      <div>
        <p className="text-2xl md:text-3xl font-bold">{value}</p>
        <p className="text-sm text-white/50 uppercase tracking-wider">
          {label}
        </p>
      </div>
    </motion.div>
  );
}

export function YearInNumbersSection({
  year,
  overview,
  typeBreakdown,
  rewatchStats,
  activityPatterns,
}: YearInNumbersSectionProps) {
  const movieCount = typeBreakdown.movie.playCount;
  const episodeCount = typeBreakdown.episode.playCount;

  return (
    <section className="relative py-28 px-4 md:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 to-transparent" />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 0.04, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-[15rem] md:text-[25rem] font-black text-white tracking-tighter"
        >
          {year}
        </motion.span>
      </div>

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-7 h-7 text-blue-400" strokeWidth={1.5} />
            <p className="text-base text-white/50 uppercase tracking-wider">
              By the numbers
            </p>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Your {year} in Stats
          </h2>
          <div className="flex items-start gap-4">
            <div className="hidden md:block w-px self-stretch bg-gradient-to-b from-blue-400 to-transparent" />
            <p className="text-xl md:text-2xl text-white/70 max-w-2xl leading-relaxed">
              <Highlight>
                {overview.totalPlays.toLocaleString()} plays
              </Highlight>{" "}
              across{" "}
              <Highlight>
                {overview.uniqueItemsWatched.toLocaleString()} titles
              </Highlight>
              . <Tagline>Here's how you spent your time.</Tagline>
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
          <StatItem
            icon={<Play className="w-6 h-6" />}
            value={overview.totalPlays.toLocaleString()}
            label="Plays"
            delay={0.1}
          />
          <StatItem
            icon={<Clock className="w-6 h-6" />}
            value={formatDuration(overview.totalWatchTimeSeconds)}
            label="Watch Time"
            delay={0.15}
          />
          <StatItem
            icon={<Film className="w-6 h-6" />}
            value={overview.uniqueItemsWatched.toLocaleString()}
            label="Unique Titles"
            delay={0.2}
          />
          <StatItem
            icon={<Calendar className="w-6 h-6" />}
            value={overview.totalDaysWithActivity}
            label="Days Watched"
            delay={0.25}
          />
          <StatItem
            icon={<Flame className="w-6 h-6" />}
            value={`${activityPatterns.longestStreak} days`}
            label="Longest Streak"
            delay={0.3}
          />
          <StatItem
            icon={<Repeat className="w-6 h-6" />}
            value={`${rewatchStats.rewatchPercentage}%`}
            label="Rewatches"
            delay={0.35}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 pt-16 border-t border-white/10"
        >
          <SubsectionHeader>Content breakdown</SubsectionHeader>

          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-medium">Movies</span>
                <span className="text-white/60">
                  {movieCount} plays &bull;{" "}
                  {formatDuration(typeBreakdown.movie.watchTimeSeconds)}
                </span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${typeBreakdown.movie.percentage}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                />
              </div>
              <p className="text-sm text-white/40 mt-2">
                {typeBreakdown.movie.percentage}% of total watch time
              </p>
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-medium">Episodes</span>
                <span className="text-white/60">
                  {episodeCount} plays &bull;{" "}
                  {formatDuration(typeBreakdown.episode.watchTimeSeconds)}
                </span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{
                    width: `${typeBreakdown.episode.percentage}%`,
                  }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full"
                />
              </div>
              <p className="text-sm text-white/40 mt-2">
                {typeBreakdown.episode.percentage}% of total watch time
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
