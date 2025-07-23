"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/utils";
import { Item } from "@streamystats/database/schema";
import {
  TrendingUp,
  Users,
  Calendar,
  Percent,
  Clock,
  Video,
  Folder,
  Tag,
  Play,
  CheckCircle,
} from "lucide-react";

interface SeriesEpisodeStats {
  totalSeasons: number;
  totalEpisodes: number;
  watchedEpisodes: number;
  watchedSeasons: number;
}

interface ItemDetailsResponse {
  item: Item;
  totalViews: number;
  totalWatchTime: number;
  completionRate: number;
  firstWatched: Date | null;
  lastWatched: Date | null;
  usersWatched: any[];
  watchHistory: any[];
  watchCountByMonth: any[];
  episodeStats?: any;
}

interface ItemMetadataProps {
  item: Item;
  statistics: ItemDetailsResponse;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "Never";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
}

export function ItemMetadata({ item, statistics }: ItemMetadataProps) {
  const {
    totalViews,
    totalWatchTime,
    completionRate,
    firstWatched,
    lastWatched,
    usersWatched,
  } = statistics;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Watch Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Watch Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-primary">
                {totalViews}
              </span>
              <span className="text-sm text-muted-foreground">Total Views</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-primary">
                {formatDuration(totalWatchTime)}
              </span>
              <span className="text-sm text-muted-foreground">
                Total Watch Time
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <Percent className="w-4 h-4" />
                <span className="text-lg font-semibold">
                  {completionRate.toFixed(1)}%
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                Avg Completion
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span className="text-lg font-semibold">
                  {usersWatched.length}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                Unique Viewers
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                First Watched:
              </span>
              <span className="text-sm">{formatDate(firstWatched)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Last Watched:
              </span>
              <span className="text-sm">{formatDate(lastWatched)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Series Episode Statistics - Only show for Series */}
      {item.type === "Series" && statistics.episodeStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Episode Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-primary">
                  {statistics.episodeStats.totalSeasons}
                </span>
                <span className="text-sm text-muted-foreground">
                  Total Seasons
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-primary">
                  {statistics.episodeStats.totalEpisodes}
                </span>
                <span className="text-sm text-muted-foreground">
                  Total Episodes
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-lg font-semibold">
                    {statistics.episodeStats.watchedSeasons}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Watched Seasons
                </span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-lg font-semibold">
                    {statistics.episodeStats.watchedEpisodes}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Watched Episodes
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Technical Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {item.container && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Container:
                </span>
                <Badge variant="outline">{item.container.toUpperCase()}</Badge>
              </div>
            )}

            {item.width && item.height && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Resolution:
                </span>
                <Badge variant="outline">
                  {item.width}×{item.height}
                </Badge>
              </div>
            )}

            {item.hasSubtitles !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Subtitles:
                </span>
                <Badge variant={item.hasSubtitles ? "default" : "secondary"}>
                  {item.hasSubtitles ? "Available" : "None"}
                </Badge>
              </div>
            )}

            {item.videoType && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Video Type:
                </span>
                <Badge variant="outline">{item.videoType}</Badge>
              </div>
            )}

            {item.premiereDate && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Premiere:</span>
                <span className="text-sm">
                  {new Intl.DateTimeFormat("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }).format(new Date(item.premiereDate))}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
