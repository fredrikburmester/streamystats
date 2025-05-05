"use client";

import { Item } from "@/lib/db";
import { formatDuration, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Star, Film, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "@/components/ui/input";
import { PlaybackMethodBadge } from "@/components/PlaybackMethodBadge";
import JellyfinAvatar from "@/components/JellyfinAvatar";
import Link from "next/link";
import { useQueryParams } from "@/hooks/useQueryParams";

interface WatchHistoryItem {
  id: number;
  user_id: number;
  user_name: string;
  jellyfin_id: string;
  start_time: string;
  play_duration: number;
  percent_complete: number;
  completed: boolean;
  client_name: string;
  device_name: string;
  transcoding_is_video_direct: boolean;
  transcoding_is_audio_direct: boolean;
  transcoding_video_codec: string;
  transcoding_audio_codec: string;
  transcoding_bitrate: number;
  play_method: string;
  transcoding_width: number;
  transcoding_height: number;
  transcoding_audio_channels: number;
}

interface UserWatched {
  user_id: number;
  user_name: string;
  view_count: number;
  total_watch_time: number;
  last_watched: string;
}

interface MonthlyStats {
  month: string;
  view_count: number;
  total_watch_time: number;
}

export interface ItemStatistics {
  total_watch_time: number;
  watch_count: number;
  users_watched: UserWatched[];
  watch_history: WatchHistoryItem[];
  watch_count_by_month: MonthlyStats[];
  first_watched: string | null;
  last_watched: string | null;
  completion_rate: number;
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
}

interface ItemDetailsTableProps {
  item: Item;
  statistics: ItemStatistics;
  serverUrl?: string;
}

export function ItemDetailsTable({ item, statistics, serverUrl }: ItemDetailsTableProps) {
  const searchParams = useSearchParams();
  const { updateQueryParams } = useQueryParams();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedCallback((value: string) => {
    updateQueryParams({
      search: value,
    });
  }, 300);

  const handlePageChange = (newPage: number) => {
    updateQueryParams({
      page: newPage.toString(),
    });
  };

  const getImageUrl = (): string | undefined => {
    if (!item.primary_image_tag) return undefined;
    return `${serverUrl}/Items/${item.jellyfin_id}/Images/Primary?tag=${item.primary_image_tag}`;
  };

  // Format monthly stats data for the graph
  const monthlyStatsData = statistics.watch_count_by_month.map(stat => ({
    ...stat,
    total_watch_time: Math.round(stat.total_watch_time / 3600), // Convert to hours
  }));

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-[300px,1fr]">
        {/* Poster and Basic Info */}
        <div className="space-y-4">
          <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
            {getImageUrl() ? (
              <img
                src={getImageUrl()}
                alt={item.name}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Film className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full"
            asChild
          >
            <a
              href={`${serverUrl}/web/index.html#!/details?id=${item.jellyfin_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in Jellyfin
            </a>
          </Button>
        </div>

        {/* Item Details */}
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Watch Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(statistics.total_watch_time)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Watch Count</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.watch_count}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {statistics.users_watched.length} unique viewers
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.completion_rate.toFixed(1)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">First Watched</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statistics.first_watched ? formatDate(statistics.first_watched) : '-'}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Item Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Type</h3>
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{item.type}</span>
                  </div>
                </div>
                {item.production_year && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Year</h3>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{item.production_year}</span>
                    </div>
                  </div>
                )}
                {item.official_rating && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Rating</h3>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-muted-foreground" />
                      <span>{item.official_rating}</span>
                    </div>
                  </div>
                )}
                {item.community_rating && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">User Rating</h3>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-muted-foreground" />
                      <span>{item.community_rating.toFixed(1)}★</span>
                    </div>
                  </div>
                )}
              </div>

              {item.genres && item.genres.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Genres</h3>
                  <div className="flex flex-wrap gap-2">
                    {item.genres.map((genre) => (
                      <Badge key={genre} variant="secondary">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {item.overview && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Overview</h3>
                  <p className="text-sm text-muted-foreground">{item.overview}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Watch Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Watch Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyStatsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--secondary))" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="view_count" name="Watch Count" fill="hsl(var(--primary))" />
                    <Bar yAxisId="right" dataKey="total_watch_time" name="Watch Time (hours)" fill="hsl(var(--secondary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Watch History */}
          <Card>
            <CardHeader>
              <CardTitle>Watch History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search..."
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      debouncedSearch(e.target.value);
                    }}
                    className="h-8 w-[200px]"
                  />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Play Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statistics.watch_history.map((watch) => (
                    <TableRow key={watch.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <JellyfinAvatar
                            user={{ id: watch.user_id.toString(), name: watch.user_name, jellyfin_id: watch.jellyfin_id }}
                            serverUrl={serverUrl}
                            className="h-6 w-6"
                          />
                          <Link
                            href={`/servers/${item.server_id}/users/${watch.user_id}`}
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {watch.user_name || 'Unknown User'}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(watch.start_time)}</TableCell>
                      <TableCell>{formatDuration(watch.play_duration)}</TableCell>
                      <TableCell>{watch.percent_complete.toFixed(1)}%</TableCell>
                      <TableCell>{watch.device_name}</TableCell>
                      <TableCell>
                        <PlaybackMethodBadge
                          isVideoDirect={watch.transcoding_is_video_direct}
                          isAudioDirect={watch.transcoding_is_audio_direct}
                          videoCodec={watch.transcoding_video_codec}
                          audioCodec={watch.transcoding_audio_codec}
                          bitrate={watch.transcoding_bitrate}
                          playMethod={watch.play_method}
                          width={watch.transcoding_width}
                          height={watch.transcoding_height}
                          audioChannels={watch.transcoding_audio_channels}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {statistics.page} of {statistics.total_pages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(statistics.page - 1)}
                    disabled={statistics.page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(statistics.page + 1)}
                    disabled={statistics.page >= statistics.total_pages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 