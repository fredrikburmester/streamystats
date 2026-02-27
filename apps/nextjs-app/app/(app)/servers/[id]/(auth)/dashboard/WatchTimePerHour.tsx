"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { WatchTimePerHour as IWatchTimePerHour } from "@/lib/db/users";
import { utcHourToLocalHour } from "@/lib/timezone";
import { formatDuration } from "@/lib/utils";
import { useServerTimezone } from "@/providers/ServerTimezoneProvider";

const chartConfig = {
  watchTime: {
    label: "Watch Time",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface Props {
  title: string;
  subtitle: string;
  data: IWatchTimePerHour[];
}

export const WatchTimePerHour: React.FC<Props> = ({
  title,
  subtitle,
  data,
}) => {
  const timezone = useServerTimezone();

  const formattedData = React.useMemo(() => {
    if (!data) return [];

    // Convert UTC hours to local hours and sort by local hour (0-23)
    const converted = data.map((item) => {
      const localHour = utcHourToLocalHour(item.hour, timezone);
      return {
        hour: formatHour(localHour),
        watchTime: item.watchTime,
        rawHour: localHour,
      };
    });

    // Sort by local hour so chart displays 00, 01, 02, ... 23
    return converted.sort((a, b) => a.rawHour - b.rawHour);
  }, [data, timezone]);

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          id="watch-time-per-hour"
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart data={formattedData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(val, _, entry) => {
                    const rawHour = entry?.payload?.rawHour;
                    const formattedHour =
                      rawHour !== undefined ? formatHour(rawHour, true) : "";

                    return (
                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-medium">
                          {formattedHour}
                        </div>
                        <div className="flex flex-row items-center justify-between w-full">
                          <p>{formatDuration(Number(val), "seconds")}</p>
                        </div>
                      </div>
                    );
                  }}
                  hideLabel
                />
              }
            />
            <Bar
              dataKey="watchTime"
              fill="#2761D9"
              radius={[4, 4, 0, 0]}
              name="Watch Time"
              maxBarSize={16}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

// Helper function to format hours in 24-hour format
function formatHour(hour: number, detailed = false): string {
  if (detailed) {
    return `${hour.toString().padStart(2, "0")}:00`;
  }
  return hour.toString().padStart(2, "0");
}
