"use client";

import { TrendingUp } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { GenreStat } from "@/lib/db";
import { cn, formatDuration } from "@/lib/utils";
import { extend } from "lodash";

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
  return (
    <Card {...props} className={cn("", className)}>
      <CardHeader className="items-center pb-4">
        <CardTitle>Most Watched Genres</CardTitle>
        {/* <CardDescription>Showing most watched genres</CardDescription> */}
      </CardHeader>
      <CardContent className="pb-0">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius={90}>
              <PolarGrid />
              <PolarAngleAxis
                dataKey="genre"
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <Radar
                name="Watch Time"
                dataKey="watch_time"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.6}
                dot={{
                  r: 4,
                  fillOpacity: 1,
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
                          <span className="font-mono ml-2">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
