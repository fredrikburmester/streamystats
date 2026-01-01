"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { TypeBreakdown } from "@/lib/db/wrapped";
import { formatDuration } from "@/lib/utils";

interface WrappedTypeChartProps {
  data: TypeBreakdown;
}

const chartConfig = {
  hours: {
    label: "Hours",
  },
  movies: {
    label: "Movies",
    color: "hsl(var(--chart-1))",
  },
  series: {
    label: "Series",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function WrappedTypeChart({ data }: WrappedTypeChartProps) {
  const chartData = [
    {
      type: "Movies",
      hours: Math.round(data.movie.watchTimeSeconds / 3600),
      watchTimeSeconds: data.movie.watchTimeSeconds,
      percentage: data.movie.percentage,
      fill: "var(--color-movies)",
    },
    {
      type: "Series",
      hours: Math.round(data.episode.watchTimeSeconds / 3600),
      watchTimeSeconds: data.episode.watchTimeSeconds,
      percentage: data.episode.percentage,
      fill: "var(--color-series)",
    },
  ];

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <BarChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="type"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          fontSize={12}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{item.payload.type}</span>
                  <span className="text-muted-foreground">
                    {formatDuration(item.payload.watchTimeSeconds)}
                  </span>
                  <span className="text-muted-foreground">
                    {item.payload.percentage}% of total
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="hours" strokeWidth={2} radius={8} />
      </BarChart>
    </ChartContainer>
  );
}
