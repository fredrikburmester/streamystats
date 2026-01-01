"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { HourlyPattern } from "@/lib/db/wrapped";
import { formatDuration } from "@/lib/utils";

interface WrappedHourlyChartProps {
  data: HourlyPattern[];
  peakHour: number;
}

const chartConfig = {
  minutes: {
    label: "Minutes",
    color: "hsl(var(--foreground))",
  },
} satisfies ChartConfig;

export function WrappedHourlyChart({
  data,
  peakHour,
}: WrappedHourlyChartProps) {
  const chartData = data.map((d) => ({
    hour: `${d.hour.toString().padStart(2, "0")}:00`,
    hourNum: d.hour,
    minutes: Math.round(d.watchTimeSeconds / 60),
    watchTimeSeconds: d.watchTimeSeconds,
    isPeak: d.hour === peakHour,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[180px] w-full">
      <BarChart data={chartData}>
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          interval={2}
          fontSize={10}
        />
        <YAxis hide />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{item.payload.hour}</span>
                  <span className="text-muted-foreground">
                    {formatDuration(item.payload.watchTimeSeconds)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="minutes"
          fill="hsl(var(--foreground) / 0.3)"
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
