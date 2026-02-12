"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { GenreStat } from "@/lib/db/users";
import { cn, formatDuration } from "@/lib/utils";

const chartConfig = {
  total_duration: {
    label: "Total_duration",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  data: GenreStat[];
}

export const GenreStatsGraph: React.FC<Props> = ({
  data,
  className,
  ...props
}) => {
  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.watchTime - a.watchTime);
    const topGenres = sorted.slice(0, 12);

    // "Balance" the sort for a better shape (Center the largest, then alternate)
    // Result: [4, 2, 0, 1, 3, 5] (indices from sorted array)
    const balanced: typeof topGenres = [];

    // Place the largest item at the top/center (depending on radar start angle, usually top)
    if (topGenres.length > 0) {
       balanced.push(topGenres[0]); 
    }

    // Alternate adding to the array to distribute magnitude
    for (let i = 1; i < topGenres.length; i++) {
      if (i % 2 === 1) {
        // Add to the right (or end of array)
        balanced.push(topGenres[i]);
      } else {
        // Add to the left (or beginning of array)
        balanced.unshift(topGenres[i]);
      }
    }

    return balanced.map((item) => ({
        ...item,
        normalizedWatchTime: Math.pow(item.watchTime, 0.6),
      }));
  }, [data]);

  return (
    <Card {...props} className={cn("", className)}>
      <CardHeader className="items-center pb-4">
        <CardTitle>Most Watched Genres</CardTitle>
        {/* <CardDescription>Showing most watched genres</CardDescription> */}
      </CardHeader>
      <CardContent className="pb-0">
        <ChartContainer
          id="genre-stats"
          config={chartConfig}
          className="h-[300px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} outerRadius={90} startAngle={180} endAngle={-180}>
              <PolarGrid />
              <PolarAngleAxis
                dataKey="genre"
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <Radar
                name="Watch Time"
                dataKey="normalizedWatchTime"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.6}
                dot={{
                  r: 4,
                  fillOpacity: 1,
                }}
              />
              <ChartTooltip
                formatter={(val) => (
                  <div>
                    <p>{formatDuration(Number(val))}</p>
                  </div>
                )}
                cursor={false}
                content={<ChartTooltipContent />}
              />
            </RadarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
