"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

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
import { formatDuration } from "@/lib/utils";
import { Statistics } from "@/lib/db";
import { utcHourToLocalHour, TIMEZONE } from "@/lib/timezone";

const chartConfig = {
  minutes: {
    label: "Minutes",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface Props {
  title: string;
  subtitle: string;
  data: Statistics["watchtime_per_hour"];
}

export const WatchTimePerHour: React.FC<Props> = ({
  title,
  subtitle,
  data,
}) => {
  const formattedData = React.useMemo(() => {
    return data.map((item) => {
      const localHour = utcHourToLocalHour(item.hour);

      return {
        hour: formatHour(localHour),
        minutes: Math.floor(item.duration / 60),
        rawHour: localHour,
      };
    });
  }, [data]);

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
                  formatter={(m, _, entry) => {
                    const rawHour = entry?.payload?.rawHour;
                    const formattedHour =
                      rawHour !== undefined ? formatHour(rawHour, true) : "";

                    return (
                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-medium">
                          {formattedHour}
                        </div>
                        <div className="flex flex-row items-center justify-between w-full">
                          <p>{formatDuration(Number(m), "minutes")}</p>
                        </div>
                      </div>
                    );
                  }}
                  hideLabel
                />
              }
            />
            <Bar
              dataKey="minutes"
              fill="#2761D9"
              radius={[4, 4, 0, 0]}
              name="Minutes"
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
