"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryParams } from "@/hooks/useQueryParams";
import { WatchTimePerDay } from "@/lib/db";
import { cn, formatDuration } from "@/lib/utils";
import { Suspense, useTransition } from "react";

const chartConfig = {
  Episode: {
    label: "Episodes",
    color: "hsl(var(--chart-1))",
  },
  Movie: {
    label: "Movies",
    color: "hsl(var(--chart-5))",
  },
  Other: {
    label: "Other",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

interface Props {
  data?: WatchTimePerDay;
  onLoadingChange?: (isLoading: boolean) => void;
}

// Separate the chart visualization from the controls
function WatchTimeChartView({
  data,
  dateRange,
}: {
  data?: WatchTimePerDay;
  dateRange: { startDate?: Date; endDate?: Date };
}) {
  const { startDate, endDate } = dateRange;

  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 90); // Default to 90 days
    return date;
  };

  const defaultEndDate = new Date();

  const filteredData = React.useMemo(() => {
    if (!data) return [];
    const formattedData = data.map((item) => {
      // Calculate Movie and Episode watchtime
      const movieWatchtime = Math.floor(
        (item.watchtime_by_type.find((i) => i.item_type === "Movie")
          ?.total_duration || 0) / 60,
      );

      const episodeWatchtime = Math.floor(
        (item.watchtime_by_type.find((i) => i.item_type === "Episode")
          ?.total_duration || 0) / 60,
      );

      // Calculate Other watchtime (total - movie - episode)
      const totalWatchtime = item.watchtime_by_type.reduce(
        (acc, curr) => acc + Math.floor(curr.total_duration / 60),
        0,
      );

      const otherWatchtime = totalWatchtime - movieWatchtime - episodeWatchtime;

      return {
        date: new Date(item.date).toISOString().split("T")[0],
        Movie: movieWatchtime,
        Episode: episodeWatchtime,
        Other: Math.max(0, otherWatchtime), // Ensure we don't get negative values
      };
    });

    const start = startDate || getDefaultStartDate();
    const end = endDate || defaultEndDate;

    const filteredData = formattedData.filter((item) => {
      const date = new Date(item.date);
      return date >= start && date <= end;
    });

    const result = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateString = d.toISOString().split("T")[0];
      const existingData = filteredData.find(
        (item) => item.date === dateString,
      );
      if (existingData) {
        result.push(existingData);
      } else {
        result.push({ date: dateString, Movie: 0, Episode: 0, Other: 0 });
      }
    }

    return result;
  }, [data, startDate, endDate]);

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[250px] w-full"
    >
      <BarChart data={filteredData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(value) => {
            const date = new Date(value);
            return date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
          }}
        />
        <ChartTooltip
          cursor={false}
          content={({ label, payload }) => {
            if (!payload || !payload.length) return null;
            return (
              <div className="p-2 rounded bg-background border border-border shadow min-w-[140px]">
                <div className="font-semibold mb-1">{label}</div>
                {payload.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block w-3 h-3 rounded"
                      style={{ background: entry.color }}
                    />
                    <span className="flex-1">{entry.name}</span>
                    <span className="font-mono ml-2">{formatDuration(Number(entry.value), "minutes")}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Bar
          dataKey="Episode"
          fill={chartConfig.Episode.color}
          radius={[4, 4, 0, 0]}
          name="Episode"
        />
        <Bar
          dataKey="Movie"
          fill={chartConfig.Movie.color}
          radius={[4, 4, 0, 0]}
          name="Movie"
        />
        <Bar
          dataKey="Other"
          fill={chartConfig.Other.color}
          radius={[4, 4, 0, 0]}
          name="Other"
        />
      </BarChart>
    </ChartContainer>
  );
}

// Loading component when chart is refreshing
function LoadingChart() {
  return (
    <div className="aspect-auto h-[250px] w-full flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">
        Loading chart data...
      </div>
    </div>
  );
}

// Controls component for date selection
function WatchTimeControls({
  startDate,
  endDate,
  onDateChange,
  onPresetChange,
  isLoading,
}: {
  startDate?: Date;
  endDate?: Date;
  onDateChange: (type: "start" | "end", date?: Date) => void;
  onPresetChange: (value: string) => void;
  isLoading: boolean;
}) {
  // Determine the current preset based on date difference
  const getCurrentPreset = (): string => {
    if (!startDate || !endDate) return "90d";

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) return "7d";
    if (diffDays <= 30) return "30d";
    return "90d";
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* Date range picker */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[150px] justify-start text-left font-normal"
              disabled={isLoading}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) => onDateChange("start", date)}
              initialFocus
              disabled={(date) =>
                date > new Date() || (endDate ? date > endDate : false)
              }
            />
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground">to</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[150px] justify-start text-left font-normal"
              disabled={isLoading}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(date) => onDateChange("end", date)}
              initialFocus
              disabled={(date) =>
                date > new Date() || (startDate ? date < startDate : false)
              }
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Preset options */}
      <Select
        value={getCurrentPreset()}
        onValueChange={onPresetChange}
        disabled={isLoading}
      >
        <SelectTrigger
          className="w-[160px] rounded-lg sm:ml-auto"
          aria-label="Select a time range"
        >
          <SelectValue placeholder="Presets" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="90d" className="rounded-lg">
            Last 3 months
          </SelectItem>
          <SelectItem value="30d" className="rounded-lg">
            Last 30 days
          </SelectItem>
          <SelectItem value="7d" className="rounded-lg">
            Last 7 days
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// Main component
export function WatchTimeGraph({ data, onLoadingChange }: Props) {
  const searchParams = useSearchParams();
  const { updateQueryParams } = useQueryParams();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = React.useState(false);

  // Get date parameters from URL or set defaults
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  // Always initialize with default dates first
  const defaultEndDate = new Date();
  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 90); // Default to 90 days
    return date;
  };

  // Initialize state with defaults first, then update if params exist
  const [startDate, setStartDate] = React.useState<Date>(getDefaultStartDate());
  const [endDate, setEndDate] = React.useState<Date>(defaultEndDate);

  // Update dates from URL params in an effect
  React.useEffect(() => {
    const updateDateFromParam = (param: string | null, setter: (date: Date) => void) => {
      if (param) {
        try {
          const parsedDate = new Date(param);
          if (!isNaN(parsedDate.getTime())) {
            setter(parsedDate);
          }
        } catch (error) {
          console.error('Error parsing date:', error);
        }
      }
    };

    updateDateFromParam(startDateParam, setStartDate);
    updateDateFromParam(endDateParam, setEndDate);
  }, [startDateParam, endDateParam]);

  // Format date for query params
  const formatDateForParams = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  // Update the URL when dates change
  const handleDateChange = (type: "start" | "end", date?: Date) => {
    if (!date) return; // Don't proceed if no date is provided

    setIsLoading(true);
    const newDate = new Date(date);

    if (type === "start") {
      setStartDate(newDate);
      startTransition(() => {
        updateQueryParams({
          startDate: formatDateForParams(newDate),
        });
      });
    } else {
      setEndDate(newDate);
      startTransition(() => {
        updateQueryParams({
          endDate: formatDateForParams(newDate),
        });
      });
    }
  };

  // Handle preset selection
  const handlePresetChange = (value: string) => {
    setIsLoading(true);

    const end = new Date();
    const start = new Date();

    if (value === "30d") {
      start.setDate(start.getDate() - 30);
    } else if (value === "7d") {
      start.setDate(start.getDate() - 7);
    } else {
      start.setDate(start.getDate() - 90);
    }

    setStartDate(start);
    setEndDate(end);

    startTransition(() => {
      updateQueryParams({
        startDate: formatDateForParams(start),
        endDate: formatDateForParams(end),
      });
    });
  };

  // Update loading state and notify parent if needed
  React.useEffect(() => {
    const isCurrentlyLoading = isLoading || isPending;
    if (onLoadingChange) {
      onLoadingChange(isCurrentlyLoading);
    }

    // Reset internal loading state when transition completes
    if (!isPending && isLoading) {
      setIsLoading(false);
    }
  }, [isLoading, isPending, onLoadingChange]);

  return (
    <Card>
      <CardHeader className="flex md:items-center gap-2 space-y-0 border-b py-5 sm:flex-row p-4 md:p-6">
        <div className="grid flex-1 gap-1">
          <CardTitle>Watch Time Per Day</CardTitle>
          <CardDescription>
            Showing total watch time for the selected period
          </CardDescription>
        </div>
        <div className="mr-4">
          {Object.entries(chartConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-[2px] mr-2"
                style={{ backgroundColor: config.color }}
              ></div>
              <p className="text-xs">{config.label}</p>
            </div>
          ))}
        </div>

        <WatchTimeControls
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
          onPresetChange={handlePresetChange}
          isLoading={isLoading || isPending}
        />
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading || isPending ? (
          <LoadingChart />
        ) : (
          <Suspense fallback={<LoadingChart />}>
            <WatchTimeChartView
              data={data}
              dateRange={{ startDate, endDate }}
            />
          </Suspense>
        )}
      </CardContent>
    </Card>
  );
}
