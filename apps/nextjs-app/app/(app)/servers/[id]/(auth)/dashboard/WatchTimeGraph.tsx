"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  parseISO,
  startOfDay,
  startOfISOWeek,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import * as React from "react";
import { Suspense } from "react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryParams } from "@/hooks/useQueryParams";
import type { WatchTimePerType } from "@/lib/db/statistics";
import { formatDuration } from "@/lib/utils";

const chartConfig = {
  Episode: {
    label: "Episodes",
    color: "hsl(var(--chart-1))",
  },
  Movie: {
    label: "Movies",
    color: "hsl(var(--chart-5))",
  },
  Music: {
    label: "Music",
    color: "hsl(var(--chart-2))",
  },
  Other: {
    label: "Other",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

type WatchtimeBucket = "day" | "week" | "month" | "year";

function parseBucketParam(value: string | null): WatchtimeBucket {
  if (value === "week" || value === "month" || value === "year") return value;
  return "day";
}

function bucketStart(bucket: WatchtimeBucket, date: Date): Date {
  if (bucket === "week") return startOfISOWeek(date);
  if (bucket === "month") return startOfMonth(date);
  if (bucket === "year") return startOfYear(date);
  return startOfDay(date);
}

function addBucket(bucket: WatchtimeBucket, date: Date): Date {
  if (bucket === "week") return addWeeks(date, 1);
  if (bucket === "month") return addMonths(date, 1);
  if (bucket === "year") return addYears(date, 1);
  return addDays(date, 1);
}

function formatBucketKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

interface Props {
  data?: WatchTimePerType;
  onLoadingChange?: (isLoading: boolean) => void;
  startDate: string;
  endDate: string;
}

function WatchTimeChartView({
  data,
  startDate,
  endDate,
  bucket,
  serverId,
}: {
  data: WatchTimePerType;
  startDate: string;
  endDate: string;
  bucket: WatchtimeBucket;
  serverId: string;
}) {
  const router = useRouter();
  const rangeStart = React.useMemo(() => {
    const d = startOfDay(new Date(startDate));
    if (Number.isNaN(d.getTime())) {
      return addDays(startOfDay(new Date()), -7);
    }
    return d;
  }, [startDate]);

  const rangeEnd = React.useMemo(() => {
    const d = startOfDay(new Date(endDate));
    if (Number.isNaN(d.getTime())) {
      return startOfDay(new Date());
    }
    return d;
  }, [endDate]);

  const tickFormatter = React.useCallback(
    (value: string) => {
      const date = new Date(value);
      if (bucket === "month") {
        return date.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      }

      if (bucket === "year") {
        return date.toLocaleDateString("en-US", { year: "numeric" });
      }

      // day + week
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    },
    [bucket],
  );

  const tooltipFormatter = React.useCallback(
    (value: unknown, name: unknown, item: { color?: string } | undefined) => {
      return (
        <div className="flex flex-row items-center w-full">
          <div
            className="w-2 h-2 rounded-[2px] mr-2"
            style={{ backgroundColor: item?.color }}
          />
          <p className="">{String(name)}</p>
          <p className="ml-auto">{formatDuration(Number(value), "seconds")}</p>
        </div>
      );
    },
    [],
  );

  const filteredData = React.useMemo(() => {
    if (!data) return [];

    const start = bucketStart(bucket, rangeStart);
    const end = bucketStart(bucket, rangeEnd);

    const bucketMap: Record<
      string,
      { Movie: number; Episode: number; Music: number; Other: number }
    > = {};

    const ensureBucket = (bucketKey: string) => {
      if (bucketMap[bucketKey]) return;
      bucketMap[bucketKey] = { Movie: 0, Episode: 0, Music: 0, Other: 0 };
    };

    for (const [key, value] of Object.entries(data)) {
      const lastDashIndex = key.lastIndexOf("-");
      if (lastDashIndex === -1) continue;

      const dateStr = key.substring(0, lastDashIndex);
      const type = key.substring(lastDashIndex + 1);

      const parsed = parseISO(dateStr);
      if (Number.isNaN(parsed.getTime())) continue;

      const bStart = bucketStart(bucket, parsed);
      const bucketKey = formatBucketKey(bStart);
      ensureBucket(bucketKey);

      const watchTimeSeconds = value.totalWatchTime;
      if (type === "movie") bucketMap[bucketKey].Movie += watchTimeSeconds;
      else if (type === "episode")
        bucketMap[bucketKey].Episode += watchTimeSeconds;
      else if (type === "music") bucketMap[bucketKey].Music += watchTimeSeconds;
      else if (type === "other") bucketMap[bucketKey].Other += watchTimeSeconds;
    }

    const result: Array<{
      date: string;
      Movie: number;
      Episode: number;
      Music: number;
      Other: number;
    }> = [];

    for (let d = new Date(start); d <= end; d = addBucket(bucket, d)) {
      const bucketKey = formatBucketKey(d);
      ensureBucket(bucketKey);
      result.push({
        date: bucketKey,
        Movie: bucketMap[bucketKey].Movie,
        Episode: bucketMap[bucketKey].Episode,
        Music: bucketMap[bucketKey].Music,
        Other: bucketMap[bucketKey].Other,
      });
    }

    return result;
  }, [data, rangeStart, rangeEnd, bucket]);

  const handleClick = React.useCallback(
    (data: unknown) => {
      if (bucket !== "day") return;

      const eventData = data as {
        activePayload?: Array<{ payload?: { date: string } }>;
      } | null;
      const payload = eventData?.activePayload?.[0]?.payload;
      if (!payload?.date) return;

      const date = parseISO(payload.date);
      if (Number.isNaN(date.getTime())) return;

      const dateStr = format(date, "yyyy-MM-dd");
      router.push(
        `/servers/${serverId}/history?startDate=${dateStr}&endDate=${dateStr}`,
      );
    },
    [bucket, router, serverId],
  );

  return (
    <ChartContainer
      id="watch-time-graph"
      config={chartConfig}
      className="aspect-auto h-[250px] w-full"
    >
      <LineChart data={filteredData} onClick={handleClick}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={tickFormatter}
        />
        <ChartTooltip
          cursor={bucket === "day"}
          formatter={tooltipFormatter}
          content={<ChartTooltipContent indicator="dashed" />}
        />
        <Line
          type="monotone"
          dataKey="Episode"
          stroke={chartConfig.Episode.color}
          strokeWidth={2}
          dot={false}
          name="Episode"
        />
        <Line
          type="monotone"
          dataKey="Movie"
          stroke={chartConfig.Movie.color}
          strokeWidth={2}
          dot={false}
          name="Movie"
        />
        <Line
          type="monotone"
          dataKey="Music"
          stroke={chartConfig.Music.color}
          strokeWidth={2}
          dot={false}
          name="Music"
        />
        <Line
          type="monotone"
          dataKey="Other"
          stroke={chartConfig.Other.color}
          strokeWidth={2}
          dot={false}
          name="Other"
        />
      </LineChart>
    </ChartContainer>
  );
}

function LoadingChart() {
  return (
    <div className="aspect-auto h-[250px] w-full flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">
        Loading chart data...
      </div>
    </div>
  );
}

export function WatchTimeGraph({ data, startDate, endDate }: Props) {
  const searchParams = useSearchParams();
  const params = useParams();
  const serverId = params.id as string;
  const bucketParam = searchParams.get("bucket");
  const bucket = React.useMemo(
    () => parseBucketParam(bucketParam),
    [bucketParam],
  );

  const { updateQueryParams, isLoading } = useQueryParams();

  React.useEffect(() => {
    if (bucketParam !== null) return;
    updateQueryParams({ bucket: "day" });
  }, [bucketParam, updateQueryParams]);

  const handleBucketChange = React.useCallback(
    (next: string) => {
      const parsed = parseBucketParam(next);
      updateQueryParams({ bucket: parsed });
    },
    [updateQueryParams],
  );

  const title = React.useMemo(() => {
    if (bucket === "week") return "Watch Time Per Week";
    if (bucket === "month") return "Watch Time Per Month";
    if (bucket === "year") return "Watch Time Per Year";
    return "Watch Time Per Day";
  }, [bucket]);

  return (
    <Card>
      <CardHeader className="flex md:items-center gap-2 space-y-0 border-b py-5 sm:flex-row p-4 md:p-6">
        <div className="grid flex-1 gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Showing total watch time for the selected period
          </CardDescription>
        </div>
        <Select
          value={bucket}
          onValueChange={handleBucketChange}
          disabled={isLoading}
        >
          <SelectTrigger
            className="w-[160px]"
            aria-label="Select aggregation period"
          >
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>
        <div className="mr-4">
          {Object.entries(chartConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-[2px] mr-2"
                style={{ backgroundColor: config.color }}
              />
              <p className="text-xs">{config.label}</p>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <Suspense fallback={<LoadingChart />}>
          <WatchTimeChartView
            data={data || {}}
            startDate={startDate}
            endDate={endDate}
            bucket={bucket}
            serverId={serverId}
          />
        </Suspense>
      </CardContent>
    </Card>
  );
}
