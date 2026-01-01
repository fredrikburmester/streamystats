import { Flame, Repeat, Sparkles, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWrappedData } from "@/lib/db/wrapped";
import type { ServerPublic } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { WrappedCalendarHeatmap } from "./WrappedCalendarHeatmap";
import { WrappedComparisonChart } from "./WrappedComparisonChart";
import { WrappedGenreChart } from "./WrappedGenreChart";
import { WrappedHourlyChart } from "./WrappedHourlyChart";
import { WrappedMonthlyChart } from "./WrappedMonthlyChart";
import { WrappedRankedList } from "./WrappedRankedList";
import { WrappedStatCard } from "./WrappedStatCard";
import { WrappedTypeChart } from "./WrappedTypeChart";
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

  const topMovies = data.topItems.movies.map((item) => ({
    id: item.id,
    name: item.name,
    imageTag: item.primaryImageTag,
    watchTimeSeconds: item.totalPlayDuration,
    playCount: item.totalPlayCount,
  }));

  const topSeries = data.topItems.series.map((item) => ({
    id: item.id,
    name: item.name,
    imageTag: item.primaryImageTag,
    watchTimeSeconds: item.totalPlayDuration,
    playCount: item.totalPlayCount,
  }));

  const topActors = data.people.topActors.map((person) => ({
    id: person.id,
    name: person.name,
    imageTag: person.primaryImageTag,
    subtitle: `${person.itemCount} titles`,
    watchTimeSeconds: person.totalWatchTime,
    playCount: person.totalPlayCount,
  }));

  const topDirectors = data.people.topDirectors.map((person) => ({
    id: person.id,
    name: person.name,
    imageTag: person.primaryImageTag,
    subtitle: `${person.itemCount} titles`,
    watchTimeSeconds: person.totalWatchTime,
    playCount: person.totalPlayCount,
  }));

  const topPercentile = data.genrePercentiles[0];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {userName}&apos;s {year} Wrapped
            </h1>
            <p className="text-muted-foreground text-sm">
              {isAdminView ? "Admin view" : "Your year in review"}
            </p>
          </div>
        </div>
        <WrappedYearSelector
          currentYear={year}
          availableYears={availableYears}
          serverId={serverId}
          userId={isAdminView ? userId : undefined}
        />
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <WrappedStatCard
          value={formatDuration(data.overview.totalWatchTimeSeconds)}
          label="Total Watch Time"
          icon="clock"
        />
        <WrappedStatCard
          value={data.overview.totalPlays.toLocaleString()}
          label="Total Plays"
          icon="play"
        />
        <WrappedStatCard
          value={data.overview.uniqueItemsWatched.toLocaleString()}
          label="Unique Titles"
          icon="film"
        />
        <WrappedStatCard
          value={data.overview.totalDaysWithActivity.toLocaleString()}
          label="Days Watched"
          icon="calendar"
        />
      </div>

      {/* Top Content Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {topMovies.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Top Movies</CardTitle>
            </CardHeader>
            <CardContent>
              <WrappedRankedList
                items={topMovies}
                server={server}
                serverId={serverId}
                type="movie"
                maxItems={5}
              />
            </CardContent>
          </Card>
        )}

        {topSeries.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Top Series</CardTitle>
            </CardHeader>
            <CardContent>
              <WrappedRankedList
                items={topSeries}
                server={server}
                serverId={serverId}
                type="series"
                maxItems={5}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Genre Stats */}
      {data.genres.topGenres.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Top Genres</CardTitle>
            <CardDescription>
              You explored {data.genres.totalGenresExplored} genres this year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <WrappedGenreChart genres={data.genres.topGenres} />
              <div className="space-y-1">
                {data.genres.topGenres.slice(0, 5).map((genre, index) => (
                  <div
                    key={genre.genre}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-sm font-medium text-muted-foreground">
                        {index + 1}.
                      </span>
                      <span className="text-sm">{genre.genre}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {genre.percentageOfTotal}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* People Stats */}
      <div className="grid gap-6 md:grid-cols-2">
        {topActors.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Top Actors</CardTitle>
              <CardDescription>Most watched performers</CardDescription>
            </CardHeader>
            <CardContent>
              <WrappedRankedList
                items={topActors}
                server={server}
                serverId={serverId}
                type="actor"
                maxItems={5}
              />
            </CardContent>
          </Card>
        )}

        {topDirectors.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Top Directors</CardTitle>
              <CardDescription>Most watched filmmakers</CardDescription>
            </CardHeader>
            <CardContent>
              <WrappedRankedList
                items={topDirectors}
                server={server}
                serverId={serverId}
                type="director"
                maxItems={5}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Activity Patterns */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Watching Patterns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Activity Calendar
            </h4>
            <WrappedCalendarHeatmap
              data={data.activityPatterns.calendarHeatmap}
              year={year}
              serverId={serverId}
              userId={userId}
            />
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              When You Watch
            </h4>
            <WrappedHourlyChart
              data={data.activityPatterns.hourlyPatterns}
              peakHour={data.activityPatterns.peakHour}
            />
            <p className="text-sm text-muted-foreground mt-2">
              Peak watching time:{" "}
              <span className="font-semibold text-foreground">
                {data.activityPatterns.peakHour.toString().padStart(2, "0")}:00
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Monthly Trends</CardTitle>
          <CardDescription>
            Your peak month was{" "}
            {data.activityPatterns.monthlyTotals.find(
              (m) => m.month === data.activityPatterns.peakMonth,
            )?.monthName ?? "Unknown"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WrappedMonthlyChart data={data.activityPatterns.monthlyTotals} />
        </CardContent>
      </Card>

      {/* Type Breakdown & Rewatch Stats */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Movies vs Series</CardTitle>
          </CardHeader>
          <CardContent>
            <WrappedTypeChart data={data.typeBreakdown} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Rewatch Stats</CardTitle>
            <CardDescription>Across all content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted text-center">
                <Repeat className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold">
                  {data.rewatchStats.totalRewatches}
                </p>
                <p className="text-xs text-muted-foreground">Total Rewatches</p>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold">
                  {data.rewatchStats.rewatchPercentage}%
                </p>
                <p className="text-xs text-muted-foreground">Rewatch Rate</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {100 - data.rewatchStats.rewatchPercentage}% new content
                </p>
              </div>
            </div>
            {data.rewatchStats.mostRewatchedItem && (
              <>
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    Most Rewatched
                  </p>
                  <Link
                    href={`/servers/${serverId}/library/${data.rewatchStats.mostRewatchedItem.itemId}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors group"
                  >
                    <div className="w-10 h-14 relative rounded overflow-hidden bg-background shrink-0">
                      {data.rewatchStats.mostRewatchedItem.primaryImageTag ? (
                        <Image
                          src={`${server.url}/Items/${data.rewatchStats.mostRewatchedItem.itemId}/Images/Primary?fillHeight=150&fillWidth=100&quality=90&tag=${data.rewatchStats.mostRewatchedItem.primaryImageTag}`}
                          alt={data.rewatchStats.mostRewatchedItem.itemName}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          N/A
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate group-hover:underline">
                        {data.rewatchStats.mostRewatchedItem.itemName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {data.rewatchStats.mostRewatchedItem.seriesName && (
                          <span>{data.rewatchStats.mostRewatchedItem.seriesName}</span>
                        )}
                        {data.rewatchStats.mostRewatchedItem.seriesName &&
                          data.rewatchStats.mostRewatchedItem.productionYear && (
                            <span> · </span>
                          )}
                        {data.rewatchStats.mostRewatchedItem.productionYear && (
                          <span>{data.rewatchStats.mostRewatchedItem.productionYear}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold">
                        {data.rewatchStats.mostRewatchedItem.rewatchCount}
                      </p>
                      <p className="text-xs text-muted-foreground">rewatches</p>
                    </div>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Milestones */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {data.overview.firstWatch && (
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-2">
                  First Watch of {year}
                </p>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/servers/${serverId}/library/${data.overview.firstWatch.itemId}`}
                    className="w-10 h-14 relative rounded overflow-hidden bg-background shrink-0 hover:opacity-80 transition-opacity"
                  >
                    {data.overview.firstWatch.primaryImageTag ? (
                      <Image
                        src={`${server.url}/Items/${data.overview.firstWatch.itemId}/Images/Primary?fillHeight=150&fillWidth=100&quality=90&tag=${data.overview.firstWatch.primaryImageTag}`}
                        alt={data.overview.firstWatch.itemName}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        N/A
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0">
                    <Link
                      href={`/servers/${serverId}/library/${data.overview.firstWatch.itemId}`}
                      className="font-semibold text-sm truncate block hover:underline"
                    >
                      {data.overview.firstWatch.itemName}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {data.overview.firstWatch.seriesName && (
                        <span>{data.overview.firstWatch.seriesName}</span>
                      )}
                      {data.overview.firstWatch.seriesName &&
                        data.overview.firstWatch.productionYear && (
                          <span> · </span>
                        )}
                      {data.overview.firstWatch.productionYear && (
                        <span>{data.overview.firstWatch.productionYear}</span>
                      )}
                      {(data.overview.firstWatch.seriesName ||
                        data.overview.firstWatch.productionYear) && (
                        <span> · </span>
                      )}
                      <Link
                        href={`/servers/${serverId}/history?startDate=${data.overview.firstWatch.timestamp.split("T")[0]}&endDate=${data.overview.firstWatch.timestamp.split("T")[0]}&userId=${userId}`}
                        className="hover:underline"
                      >
                        {new Date(
                          data.overview.firstWatch.timestamp,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {data.overview.lastWatch && (
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-2">
                  Last Watch of {year}
                </p>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/servers/${serverId}/library/${data.overview.lastWatch.itemId}`}
                    className="w-10 h-14 relative rounded overflow-hidden bg-background shrink-0 hover:opacity-80 transition-opacity"
                  >
                    {data.overview.lastWatch.primaryImageTag ? (
                      <Image
                        src={`${server.url}/Items/${data.overview.lastWatch.itemId}/Images/Primary?fillHeight=150&fillWidth=100&quality=90&tag=${data.overview.lastWatch.primaryImageTag}`}
                        alt={data.overview.lastWatch.itemName}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        N/A
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0">
                    <Link
                      href={`/servers/${serverId}/library/${data.overview.lastWatch.itemId}`}
                      className="font-semibold text-sm truncate block hover:underline"
                    >
                      {data.overview.lastWatch.itemName}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {data.overview.lastWatch.seriesName && (
                        <span>{data.overview.lastWatch.seriesName}</span>
                      )}
                      {data.overview.lastWatch.seriesName &&
                        data.overview.lastWatch.productionYear && (
                          <span> · </span>
                        )}
                      {data.overview.lastWatch.productionYear && (
                        <span>{data.overview.lastWatch.productionYear}</span>
                      )}
                      {(data.overview.lastWatch.seriesName ||
                        data.overview.lastWatch.productionYear) && (
                        <span> · </span>
                      )}
                      <Link
                        href={`/servers/${serverId}/history?startDate=${data.overview.lastWatch.timestamp.split("T")[0]}&endDate=${data.overview.lastWatch.timestamp.split("T")[0]}&userId=${userId}`}
                        className="hover:underline"
                      >
                        {new Date(
                          data.overview.lastWatch.timestamp,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground mb-2">
                Longest Streak
              </p>
              <div className="flex items-center gap-2">
                <Flame className="h-6 w-6 text-orange-500" />
                <span className="text-2xl font-bold">
                  {data.activityPatterns.longestStreak}
                </span>
                <span className="text-muted-foreground">days</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Genre Percentiles */}
      {topPercentile && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">How You Compare</CardTitle>
            <CardDescription>
              Your watching habits vs the server average
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WrappedComparisonChart data={data.genrePercentiles} />
            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: "#1D4ED8" }}
                />
                <span>You</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-muted-foreground/30" />
                <span>Server Avg</span>
              </div>
            </div>
          </CardContent>
        </Card>
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
