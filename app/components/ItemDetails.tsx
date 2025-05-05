"use client";

import { Item } from "@/lib/db";
import { formatDuration, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Star, Film, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface WatchHistoryItem {
  id: number;
  user_id: number;
  user_name: string;
  jellyfin_user_id: string;
  start_time: string;
  play_duration: number;
  percent_complete: number;
  completed: boolean;
  client_name: string;
  device_name: string;
}

interface UserWatched {
  user_id: number;
  jellyfin_user_id: string;
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

interface ItemStatistics {
  total_watch_time: number;
  watch_count: number;
  users_watched: UserWatched[];
  watch_history: WatchHistoryItem[];
  watch_count_by_month: MonthlyStats[];
  first_watched: string | null;
  last_watched: string | null;
  completion_rate: number;
}

interface ItemDetailsProps {
  item: Item;
  statistics: ItemStatistics;
  serverUrl?: string;
}

export function ItemDetails({ item, statistics, serverUrl }: ItemDetailsProps) {
  const getImageUrl = (): string | undefined => {
    if (!item.primary_image_tag) return undefined;
    return `${serverUrl}/Items/${item.jellyfin_id}/Images/Primary?tag=${item.primary_image_tag}`;
  };

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
          <div className="grid gap-6 md:grid-cols-3">
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
                  <BarChart data={statistics.watch_count_by_month}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="view_count" fill="hsl(var(--primary))" />
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Device</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statistics.watch_history.map((watch) => (
                    <TableRow key={watch.id}>
                      <TableCell>{watch.user_name}</TableCell>
                      <TableCell>{formatDate(watch.start_time)}</TableCell>
                      <TableCell>{formatDuration(watch.play_duration)}</TableCell>
                      <TableCell>{watch.percent_complete.toFixed(1)}%</TableCell>
                      <TableCell>{watch.device_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
