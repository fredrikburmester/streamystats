"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { GenreStats } from "@/lib/db/wrapped";
import { formatDuration } from "@/lib/utils";

interface WrappedGenreChartProps {
  genres: GenreStats[];
}

export function WrappedGenreChart({ genres }: WrappedGenreChartProps) {
  const data = genres.slice(0, 5).map((g, index) => ({
    genre: g.genre,
    hours: Math.round(g.watchTimeSeconds / 3600),
    watchTimeSeconds: g.watchTimeSeconds,
    percentage: g.percentageOfTotal,
    fill: `var(--color-genre-${index + 1})`,
  }));

  const chartConfig = {
    hours: {
      label: "Hours",
    },
    ...Object.fromEntries(
      data.map((g, index) => [
        `genre-${index + 1}`,
        {
          label: g.genre,
          color: `hsl(var(--chart-${(index % 5) + 1}))`,
        },
      ]),
    ),
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="genre"
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
                  <span className="font-medium">{item.payload.genre}</span>
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
