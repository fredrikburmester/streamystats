import {
  Calendar,
  Clock,
  Film,
  Flame,
  Play,
  Repeat,
  Sparkles,
  TrendingUp,
  Tv,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getWrappedData } from "@/lib/db/wrapped";
import type { ServerPublic } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import { WrappedCalendarHeatmap } from "./WrappedCalendarHeatmap";
import { WrappedCard } from "./WrappedCard";
import { WrappedGenreChart } from "./WrappedGenreChart";
import { WrappedHourlyChart } from "./WrappedHourlyChart";
import { WrappedMonthlyChart } from "./WrappedMonthlyChart";
import { WrappedRankedList } from "./WrappedRankedList";
import { WrappedShareButton } from "./WrappedShareButton";
import { WrappedStatCard } from "./WrappedStatCard";
import { WrappedYearSelector } from "./WrappedYearSelector";

interface WrappedContentProps {
  serverId: number;
  userId: string;
  userName: string;
  year: number;
  availableYears: number[];
  server: ServerPublic;
  isAdminView?: boolean;
}

export async function WrappedContent({
  serverId,
  userId,
  userName,
  year,
  availableYears,
  server,
  isAdminView = false,
}: WrappedContentProps) {
  const data = await getWrappedData({ serverId, userId, year });

  // Prepare ranked items for top movies
  const topMovies = data.topItems.movies.map((item) => ({
    id: item.id,
    name: item.name,
    imageTag: item.primaryImageTag,
    watchTimeSeconds: item.totalPlayDuration,
    playCount: item.totalPlayCount,
  }));

  // Prepare ranked items for top series
  const topSeries = data.topItems.series.map((item) => ({
    id: item.id,
    name: item.name,
    imageTag: item.primaryImageTag,
    watchTimeSeconds: item.totalPlayDuration,
    playCount: item.totalPlayCount,
  }));

  // Prepare ranked items for top actors
  const topActors = data.people.topActors.map((person) => ({
    id: person.id,
    name: person.name,
    imageTag: person.primaryImageTag,
    subtitle: `${person.itemCount} titles`,
    watchTimeSeconds: person.totalWatchTime,
    playCount: person.totalPlayCount,
  }));

  // Prepare ranked items for top directors
  const topDirectors = data.people.topDirectors.map((person) => ({
    id: person.id,
    name: person.name,
    imageTag: person.primaryImageTag,
    subtitle: `${person.itemCount} titles`,
    watchTimeSeconds: person.totalWatchTime,
    playCount: person.totalPlayCount,
  }));

  const topGenre = data.genres.topGenres[0];
  const topPercentile = data.genrePercentiles[0];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <WrappedCard gradient="purple" className="relative">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                {userName}&apos;s {year} Wrapped
              </h1>
              <p className="text-white/70 text-sm md:text-base">
                {isAdminView ? "Admin view" : "Your year in review"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WrappedShareButton
              serverId={serverId}
              userId={userId}
              year={year}
            />
            <WrappedYearSelector
              currentYear={year}
              availableYears={availableYears}
              serverId={serverId}
              userId={isAdminView ? userId : undefined}
            />
          </div>
        </div>
      </WrappedCard>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <WrappedCard gradient="blue" className="p-4">
          <WrappedStatCard
            value={formatDuration(data.overview.totalWatchTimeSeconds)}
            label="Total Watch Time"
            icon={Clock}
          />
        </WrappedCard>
        <WrappedCard gradient="emerald" className="p-4">
          <WrappedStatCard
            value={data.overview.totalPlays.toLocaleString()}
            label="Total Plays"
            icon={Play}
          />
        </WrappedCard>
        <WrappedCard gradient="amber" className="p-4">
          <WrappedStatCard
            value={data.overview.uniqueItemsWatched.toLocaleString()}
            label="Unique Titles"
            icon={Film}
          />
        </WrappedCard>
        <WrappedCard gradient="rose" className="p-4">
          <WrappedStatCard
            value={data.overview.totalDaysWithActivity.toLocaleString()}
            label="Days Watched"
            icon={Calendar}
          />
        </WrappedCard>
      </div>

      {/* Top Content Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Movies */}
        {topMovies.length > 0 && (
          <WrappedCard gradient="amber" title="Top Movies">
            <WrappedRankedList
              items={topMovies}
              server={server}
              serverId={serverId}
              type="movie"
              maxItems={5}
            />
          </WrappedCard>
        )}

        {/* Top Series */}
        {topSeries.length > 0 && (
          <WrappedCard gradient="indigo" title="Top Series">
            <WrappedRankedList
              items={topSeries}
              server={server}
              serverId={serverId}
              type="series"
              maxItems={5}
            />
          </WrappedCard>
        )}
      </div>

      {/* Genre Stats */}
      {data.genres.topGenres.length > 0 && (
        <WrappedCard gradient="violet" title="Top Genres" subtitle={`You explored ${data.genres.totalGenresExplored} genres this year`}>
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <WrappedGenreChart genres={data.genres.topGenres} />
            <div className="space-y-3">
              {data.genres.topGenres.slice(0, 5).map((genre, index) => (
                <div
                  key={genre.genre}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-white/60">
                      {index + 1}
                    </span>
                    <span className="font-medium">{genre.genre}</span>
                  </div>
                  <span className="text-white/70">{genre.percentageOfTotal}%</span>
                </div>
              ))}
            </div>
          </div>
        </WrappedCard>
      )}

      {/* People Stats */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Actors */}
        {topActors.length > 0 && (
          <WrappedCard gradient="cyan" title="Top Actors" subtitle="Most watched performers">
            <WrappedRankedList
              items={topActors}
              server={server}
              serverId={serverId}
              type="actor"
              maxItems={5}
            />
          </WrappedCard>
        )}

        {/* Top Directors */}
        {topDirectors.length > 0 && (
          <WrappedCard gradient="pink" title="Top Directors" subtitle="Most watched filmmakers">
            <WrappedRankedList
              items={topDirectors}
              server={server}
              serverId={serverId}
              type="director"
              maxItems={5}
            />
          </WrappedCard>
        )}
      </div>

      {/* Activity Patterns */}
      <WrappedCard gradient="emerald" title="Watching Patterns">
        <div className="grid gap-6">
          {/* Calendar Heatmap */}
          <div>
            <h4 className="text-sm font-medium text-white/70 mb-3">
              Activity Calendar
            </h4>
            <WrappedCalendarHeatmap
              data={data.activityPatterns.calendarHeatmap}
              year={year}
            />
          </div>

          {/* Hourly Pattern */}
          <div>
            <h4 className="text-sm font-medium text-white/70 mb-3">
              When You Watch
            </h4>
            <WrappedHourlyChart
              data={data.activityPatterns.hourlyPatterns}
              peakHour={data.activityPatterns.peakHour}
            />
            <p className="text-sm text-white/60 mt-2">
              Peak watching time:{" "}
              <span className="font-semibold text-white">
                {data.activityPatterns.peakHour.toString().padStart(2, "0")}:00
              </span>
            </p>
          </div>
        </div>
      </WrappedCard>

      {/* Monthly Trends */}
      <WrappedCard
        gradient="blue"
        title="Monthly Trends"
        subtitle={`Your peak month was ${data.activityPatterns.monthlyTotals.find((m) => m.month === data.activityPatterns.peakMonth)?.monthName ?? "Unknown"}`}
      >
        <WrappedMonthlyChart data={data.activityPatterns.monthlyTotals} />
      </WrappedCard>

      {/* Type Breakdown & Rewatch Stats */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Movies vs Series */}
        <WrappedCard gradient="neutral" title="Movies vs Series">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Film className="h-8 w-8 text-amber-400" />
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">Movies</span>
                  <span className="text-white/70">
                    {data.typeBreakdown.movie.percentage}%
                  </span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${data.typeBreakdown.movie.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-white/60 mt-1">
                  {formatDuration(data.typeBreakdown.movie.watchTimeSeconds)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Tv className="h-8 w-8 text-indigo-400" />
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">Series</span>
                  <span className="text-white/70">
                    {data.typeBreakdown.episode.percentage}%
                  </span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 rounded-full"
                    style={{ width: `${data.typeBreakdown.episode.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-white/60 mt-1">
                  {formatDuration(data.typeBreakdown.episode.watchTimeSeconds)}
                </p>
              </div>
            </div>
          </div>
        </WrappedCard>

        {/* Rewatch Stats */}
        <WrappedCard gradient="rose" title="Rewatch Stats">
          <div className="space-y-4">
            {data.rewatchStats.mostRewatchedItem && (
              <div className="p-3 rounded-lg bg-white/10">
                <p className="text-sm text-white/70 mb-1">Most Rewatched</p>
                <p className="font-semibold">
                  {data.rewatchStats.mostRewatchedItem.itemName}
                </p>
                <p className="text-sm text-white/60">
                  Rewatched {data.rewatchStats.mostRewatchedItem.rewatchCount} times
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/10 text-center">
                <Repeat className="h-5 w-5 mx-auto mb-1 text-white/60" />
                <p className="text-xl font-bold">{data.rewatchStats.totalRewatches}</p>
                <p className="text-xs text-white/60">Total Rewatches</p>
              </div>
              <div className="p-3 rounded-lg bg-white/10 text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-white/60" />
                <p className="text-xl font-bold">{data.rewatchStats.rewatchPercentage}%</p>
                <p className="text-xs text-white/60">Rewatch Rate</p>
              </div>
            </div>
          </div>
        </WrappedCard>
      </div>

      {/* Milestones */}
      <WrappedCard gradient="indigo" title="Milestones">
        <div className="grid md:grid-cols-3 gap-4">
          {/* First Watch */}
          {data.overview.firstWatch && (
            <div className="p-4 rounded-xl bg-white/10">
              <p className="text-sm text-white/70 mb-2">First Watch of {year}</p>
              <p className="font-semibold truncate">
                {data.overview.firstWatch.itemName}
              </p>
              <p className="text-xs text-white/60 mt-1">
                {new Date(data.overview.firstWatch.timestamp).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" }
                )}
              </p>
            </div>
          )}

          {/* Last Watch */}
          {data.overview.lastWatch && (
            <div className="p-4 rounded-xl bg-white/10">
              <p className="text-sm text-white/70 mb-2">Last Watch of {year}</p>
              <p className="font-semibold truncate">
                {data.overview.lastWatch.itemName}
              </p>
              <p className="text-xs text-white/60 mt-1">
                {new Date(data.overview.lastWatch.timestamp).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" }
                )}
              </p>
            </div>
          )}

          {/* Longest Streak */}
          <div className="p-4 rounded-xl bg-white/10">
            <p className="text-sm text-white/70 mb-2">Longest Streak</p>
            <div className="flex items-center gap-2">
              <Flame className="h-6 w-6 text-orange-400" />
              <span className="text-2xl font-bold">
                {data.activityPatterns.longestStreak}
              </span>
              <span className="text-white/60">days</span>
            </div>
          </div>
        </div>
      </WrappedCard>

      {/* Genre Percentiles */}
      {topPercentile && (
        <WrappedCard
          gradient="purple"
          title="How You Compare"
          subtitle="Your watching habits vs other users on this server"
        >
          <div className="grid md:grid-cols-2 gap-4">
            {data.genrePercentiles.slice(0, 4).map((p) => (
              <div
                key={p.genre}
                className="p-4 rounded-xl bg-white/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{p.genre}</span>
                  <span className="text-sm text-white/70">
                    Top {100 - p.percentile}%
                  </span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full"
                    style={{ width: `${p.percentile}%` }}
                  />
                </div>
                <p className="text-xs text-white/60 mt-2">
                  You watched {formatDuration(p.userWatchTimeSeconds)} (avg:{" "}
                  {formatDuration(p.serverAverageSeconds)})
                </p>
              </div>
            ))}
          </div>
        </WrappedCard>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground py-4">
        <p>
          Generated on{" "}
          {new Date(data.generatedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        <p className="mt-1">Powered by Streamystats</p>
      </div>
    </div>
  );
}
