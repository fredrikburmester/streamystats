"use client";

import { Item } from "@/lib/db";
import { formatDuration, formatDate, formatCompletionRate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Star, Film, ExternalLink, ChevronDown, ArrowUpDown } from "lucide-react";
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
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

// Utility to format hours as 'Xh Ym'
function formatHoursMinutes(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return '0m';
}

export function ItemDetailsTable({ item, statistics, serverUrl }: ItemDetailsTableProps) {
  const searchParams = useSearchParams();
  const { updateQueryParams } = useQueryParams();
  const [searchInput, setSearchInput] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [sorting, setSorting] = useState<SortingState>([]);

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
    // Format month as 'MMM yyyy' for x-axis
    monthLabel: new Date(stat.month).toLocaleString("en-US", { month: "short", year: "numeric" }),
    total_watch_time: Math.round(stat.total_watch_time / 3600), // Convert to hours
  }));

  const columns: ColumnDef<WatchHistoryItem>[] = [
    {
      accessorKey: "user_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          User
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <JellyfinAvatar
            user={{ id: row.original.user_id.toString(), name: row.original.user_name, jellyfin_id: row.original.jellyfin_id }}
            serverUrl={serverUrl}
            className="h-6 w-6"
          />
          <Link
            href={`/servers/${item.server_id}/users/${row.original.user_id}`}
            className="font-medium hover:text-primary transition-colors"
          >
            {row.original.user_name || 'Unknown User'}
          </Link>
        </div>
      ),
    },
    {
      accessorKey: "start_time",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => formatDate(row.original.start_time),
    },
    {
      accessorKey: "play_duration",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Duration
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => formatDuration(row.original.play_duration),
    },
    {
      accessorKey: "percent_complete",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Progress
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => `${row.original.percent_complete.toFixed(1)}%`,
    },
    {
      accessorKey: "device_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Device
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => row.original.device_name,
    },
    {
      accessorKey: "play_method",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Play Method
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <PlaybackMethodBadge
          isVideoDirect={row.original.transcoding_is_video_direct}
          isAudioDirect={row.original.transcoding_is_audio_direct}
          videoCodec={row.original.transcoding_video_codec}
          audioCodec={row.original.transcoding_audio_codec}
          bitrate={row.original.transcoding_bitrate}
          playMethod={row.original.play_method}
          width={row.original.transcoding_width}
          height={row.original.transcoding_height}
          audioChannels={row.original.transcoding_audio_channels}
        />
      ),
    },
  ];

  const table = useReactTable({
    data: statistics.watch_history,
    columns,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    state: {
      columnFilters,
      columnVisibility,
      sorting,
    },
    manualPagination: true,
    pageCount: statistics.total_pages,
  });

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
                <div className="text-2xl font-bold">{formatCompletionRate(statistics.completion_rate)}</div>
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
                <ChartContainer
                  config={{
                    total_watch_time: {
                      label: "Watch Time",
                      color: "hsl(var(--chart-1))",
                    },
                    view_count: {
                      label: "Watch Count",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[300px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyStatsData}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="monthLabel"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={32}
                        tick={{ fontSize: 12 }}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={({ label, payload }) => {
                          if (!payload || !payload.length) return null;
                          return (
                            <div className="p-2 rounded bg-background border border-border shadow min-w-[140px]">
                              <div className="font-semibold mb-1">{label}</div>
                              {payload.map((entry: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 mb-1">
                                  <span
                                    className="inline-block w-3 h-3 rounded"
                                    style={{ background: entry.color }}
                                  />
                                  <span className="flex-1">{entry.name}</span>
                                  <span className="font-mono ml-2">
                                    {entry.dataKey === "total_watch_time"
                                      ? formatDuration(entry.value, "hours")
                                      : entry.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="total_watch_time"
                        fill="hsl(var(--chart-1))"
                        radius={[4, 4, 0, 0]}
                        name="Watch Time"
                      />
                      <Bar
                        dataKey="view_count"
                        fill="hsl(var(--chart-2))"
                        radius={[4, 4, 0, 0]}
                        name="Watch Count"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          {/* Watch History */}
          <Card>
            <CardHeader>
              <CardTitle>Watch History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="ml-auto">
                      Columns <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {table
                      .getAllColumns()
                      .filter((column) => column.getCanHide())
                      .map((column) => {
                        return (
                          <DropdownMenuCheckboxItem
                            key={column.id}
                            className="capitalize"
                            checked={column.getIsVisible()}
                            onCheckedChange={(value) =>
                              column.toggleVisibility(!!value)
                            }
                          >
                            {column.id}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          return (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          data-state={row.getIsSelected() && "selected"}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center"
                        >
                          No results.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-4">
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