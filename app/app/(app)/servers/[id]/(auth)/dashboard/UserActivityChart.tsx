"use client";

import * as React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { addDays, format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useTransition } from "react";

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
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryParams } from "@/hooks/useQueryParams";
import { UserActivityPerDay } from "@/lib/db";
import { UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const chartConfig = {
  active_users: {
    label: "Active Users",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface Props {
  data: UserActivityPerDay | null;
}

// Separate the chart visualization from the controls
function UserActivityChartView({
  data,
  dateRange,
}: {
  data?: UserActivityPerDay | null;
  dateRange: { startDate?: Date; endDate?: Date };
}) {
  const { startDate, endDate } = dateRange;

  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Default to 30 days
    return date;
  };

  const defaultEndDate = new Date();

  // Process and fill in missing dates with zero values
  const processedData = React.useMemo(() => {
    if (!data) return [];

    const start = startDate || getDefaultStartDate();
    const end = endDate || defaultEndDate;

    // Create a map of existing data for quick lookup
    const dataMap = new Map();
    data.forEach((item) => {
      dataMap.set(item.date, item.active_users);
    });

    // Fill in all dates in the range
    const result = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateString = d.toISOString().split("T")[0];
      const formattedDate = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      result.push({
        date: dateString,
        formattedDate: formattedDate,
        active_users: dataMap.get(dateString) || 0,
      });
    }

    return result; // Keep chronological order for X-axis
  }, [data, startDate, endDate]);

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[250px] w-full"
    >
      <BarChart data={processedData}>
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
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name, entry) => (
                <div className="flex flex-col gap-1 min-w-[140px]">
                  <div className="text-sm font-medium">
                    {entry?.payload?.formattedDate}
                  </div>
                  <div className="flex flex-row items-center justify-between w-full gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-[2px]"
                        style={{
                          backgroundColor: chartConfig.active_users.color,
                        }}
                      />
                      <span>Active Users</span>
                    </div>
                    <span className="font-medium ml-auto">{value}</span>
                  </div>
                </div>
              )}
              hideLabel
            />
          }
        />
        <Bar
          dataKey="active_users"
          fill={chartConfig.active_users.color}
          radius={[4, 4, 0, 0]}
          name="Active Users"
        />
      </BarChart>
    </ChartContainer>
  );
}

// Controls component for date selection
function UserActivityControls({
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
    if (!startDate || !endDate) return "30d";

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) return "7d";
    if (diffDays <= 30) return "30d";
    if (diffDays <= 90) return "90d";
    return "custom";
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

// Loading component
function LoadingChart() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

// Main component
export const UserActivityChart: React.FC<Props> = ({ data }) => {
  const searchParams = useSearchParams();
  const { updateQueryParams } = useQueryParams();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = React.useState(false);

  // Get date parameters from URL or set defaults
  const startDateParam = searchParams.get("userActivityStartDate");
  const endDateParam = searchParams.get("userActivityEndDate");

  // Always initialize with default dates first
  const defaultEndDate = new Date();
  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Default to 30 days
    return date;
  };

  // Initialize state with defaults first, then update if params exist
  const [startDate, setStartDate] = React.useState<Date>(getDefaultStartDate());
  const [endDate, setEndDate] = React.useState<Date>(defaultEndDate);

  // Update dates from URL params in an effect
  React.useEffect(() => {
    const updateDateFromParam = (
      param: string | null,
      setter: (date: Date) => void
    ) => {
      if (param) {
        try {
          const parsedDate = new Date(param);
          if (!isNaN(parsedDate.getTime())) {
            setter(parsedDate);
          }
        } catch (error) {
          console.error("Error parsing date:", error);
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
          userActivityStartDate: formatDateForParams(newDate),
        });
      });
    } else {
      setEndDate(newDate);
      startTransition(() => {
        updateQueryParams({
          userActivityEndDate: formatDateForParams(newDate),
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
    } else if (value === "90d") {
      start.setDate(start.getDate() - 90);
    }

    setStartDate(start);
    setEndDate(end);

    startTransition(() => {
      updateQueryParams({
        userActivityStartDate: formatDateForParams(start),
        userActivityEndDate: formatDateForParams(end),
      });
    });
  };

  // Reset internal loading state when transition completes
  React.useEffect(() => {
    if (!isPending && isLoading) {
      setIsLoading(false);
    }
  }, [isLoading, isPending]);

  if (!data && !isLoading && !isPending) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4" />
            <CardTitle>User Activity</CardTitle>
          </div>
          <CardDescription>Daily active users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            No user activity data available for this time period.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex md:items-center gap-2 space-y-0 border-b py-5 sm:flex-row p-4 md:p-6">
        <div className="grid flex-1 gap-1">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4" />
            <CardTitle>User Activity</CardTitle>
          </div>
          <CardDescription>
            Daily active users for the selected period
          </CardDescription>
        </div>

        <UserActivityControls
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
            <UserActivityChartView
              data={data}
              dateRange={{ startDate, endDate }}
            />
          </Suspense>
        )}
      </CardContent>
    </Card>
  );
};
