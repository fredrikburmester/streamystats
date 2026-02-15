"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Clock,
  Film,
  Folder,
  HardDrive,
  Music,
  Play,
  PlaySquare,
  Tv,
  User,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PerLibraryStatistics } from "@/lib/db/library-statistics";
import { formatBytes, formatDuration, ticksToSeconds } from "@/lib/utils";

interface Props {
  data: PerLibraryStatistics[];
  serverId: number;
  isAdmin: boolean;
}

const getLibraryConfig = (type: string) => {
  switch (type) {
    case "movies":
      return {
        icon: Film,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/20",
      };
    case "tvshows":
      return {
        icon: Tv,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/20",
      };
    case "music":
      return {
        icon: Music,
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
        borderColor: "border-purple-500/20",
      };
    default:
      return {
        icon: Folder,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/20",
      };
  }
};

const LibraryStatCard: React.FC<{
  stats: PerLibraryStatistics;
  serverId: number;
  isAdmin: boolean;
}> = ({ stats, serverId, isAdmin }) => {
  const config = getLibraryConfig(stats.libraryType);
  const Icon = config.icon;
  const isTvLibrary = stats.libraryType === "tvshows";
  const isMovieLibrary = stats.libraryType === "movies";

  return (
    <Card className={`flex flex-col border-l-4 ${config.borderColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">
          <Link
            href={`/servers/${serverId}/library?libraries=${stats.libraryId}`}
            className="hover:text-primary hover:underline underline-offset-2 transition-colors"
          >
            {stats.libraryName}
          </Link>
        </CardTitle>
        <div
          className={`flex items-center gap-2 px-2 py-1 rounded-full ${config.bgColor}`}
        >
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className={`text-xs font-medium capitalize ${config.color}`}>
            {stats.libraryType}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {/* Row 1: Total Time + Total Files */}
        <div className="grid grid-cols-2 gap-4">
          <StatItem
            label="Total Time"
            value={formatDuration(ticksToSeconds(stats.totalRuntimeTicks))}
            icon={Clock}
            iconColor="text-sky-500"
          />
          <StatItem
            label="Total Files"
            value={formatNumber(stats.totalFiles)}
            icon={Folder}
            iconColor="text-orange-500"
          />
        </div>

        {/* Row 2: Library Size + Total Plays */}
        <div className="grid grid-cols-2 gap-4">
          <StatItem
            label="Library Size"
            value={formatBytes(stats.totalSizeBytes)}
            icon={HardDrive}
            iconColor="text-slate-500"
          />
          <StatItem
            label="Total Plays"
            value={formatNumber(stats.totalPlays)}
            icon={Play}
            iconColor="text-green-500"
          />
        </div>

        {/* Row 3: Playback + Last Activity */}
        <div className="grid grid-cols-2 gap-4">
          <StatItem
            label="Total Playback"
            value={formatDuration(stats.totalPlaybackSeconds)}
            icon={PlaySquare}
            iconColor="text-violet-500"
          />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Last Activity</p>
            <p className="text-sm font-medium truncate">
              {stats.lastActivityTime
                ? formatDistanceToNow(new Date(stats.lastActivityTime), {
                    addSuffix: true,
                  })
                : "Never"}
            </p>
          </div>
        </div>

        {/* Row 4: Last Played with user info */}
        <div className={`p-2 rounded-lg ${config.bgColor} space-y-1`}>
          <p className="text-xs text-muted-foreground">Last Played</p>
          {stats.lastPlayedItemId ? (
            <Link
              href={`/servers/${serverId}/library/${stats.lastPlayedItemId}`}
              className="text-sm font-medium truncate block hover:text-primary hover:underline underline-offset-2 transition-colors"
            >
              {stats.lastPlayedItemName}
            </Link>
          ) : (
            <p className="text-sm font-medium truncate">Nothing yet</p>
          )}
          {isAdmin && stats.lastPlayedByUserName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {stats.lastPlayedByUserId ? (
                <Link
                  href={`/servers/${serverId}/users/${stats.lastPlayedByUserId}`}
                  className="hover:text-primary hover:underline underline-offset-2 transition-colors"
                >
                  by {stats.lastPlayedByUserName}
                </Link>
              ) : (
                <span>by {stats.lastPlayedByUserName}</span>
              )}
            </div>
          )}
        </div>

        {/* Row 5: Type-specific counts */}
        <div className="pt-2 border-t">
          {isTvLibrary ? (
            <div className="flex justify-between text-sm">
              <span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {stats.seriesCount}
                </span>{" "}
                <span className="text-muted-foreground">Series</span>
              </span>
              <span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {stats.seasonsCount}
                </span>{" "}
                <span className="text-muted-foreground">Seasons</span>
              </span>
              <span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {stats.episodesCount}
                </span>{" "}
                <span className="text-muted-foreground">Episodes</span>
              </span>
            </div>
          ) : isMovieLibrary ? (
            <div className="text-sm">
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {stats.moviesCount}
              </span>{" "}
              <span className="text-muted-foreground">Movies</span>
            </div>
          ) : (
            <div className="text-sm">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {stats.totalFiles}
              </span>{" "}
              <span className="text-muted-foreground">items</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const StatItem: React.FC<{
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor?: string;
}> = ({ label, value, icon: Icon, iconColor = "text-muted-foreground" }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1">
      <Icon className={`h-3 w-3 ${iconColor}`} />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
    <p className="text-sm font-medium truncate">{value}</p>
  </div>
);

export const LibraryStatisticsCards: React.FC<Props> = ({
  data,
  serverId,
  isAdmin,
}) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No libraries found
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((stats) => (
        <LibraryStatCard
          key={stats.libraryId}
          stats={stats}
          serverId={serverId}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
};

function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
