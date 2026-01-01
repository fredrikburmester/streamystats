"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { GenrePercentile } from "@/lib/db/wrapped";
import { formatDuration } from "@/lib/utils";

interface WrappedComparisonChartProps {
  data: GenrePercentile[];
}

const CHART_PRIMARY = "#1D4ED8";

const chartConfig = {
  you: {
    label: "You",
    color: CHART_PRIMARY,
  },
  average: {
    label: "Server Avg",
    color: "hsl(var(--muted-foreground) / 0.3)",
  },
} satisfies ChartConfig;

export function WrappedComparisonChart({ data }: WrappedComparisonChartProps) {
  const chartData = data.slice(0, 4).map((p) => ({
    genre: p.genre,
    you: Math.round(p.userWatchTimeSeconds / 60),
    average: Math.round(p.serverAverageSeconds / 60),
    userSeconds: p.userWatchTimeSeconds,
    avgSeconds: p.serverAverageSeconds,
    percentile: p.percentile,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full">
      <BarChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="genre"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          fontSize={12}
        />
        <YAxis hide />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => {
                const isUser = name === "you";
                return (
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">
                      {isUser ? "You" : "Server Avg"}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDuration(
                        isUser ? item.payload.userSeconds : item.payload.avgSeconds
                      )}
                    </span>
                    {isUser && (
                      <span className="text-xs text-primary">
                        Top {100 - item.payload.percentile}%
                      </span>
                    )}
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="you" fill="var(--color-you)" radius={4} />
        <Bar dataKey="average" fill="var(--color-average)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
