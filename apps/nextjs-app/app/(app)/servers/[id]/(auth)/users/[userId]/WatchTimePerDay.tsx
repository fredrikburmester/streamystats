"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatDuration } from "@/lib/utils";
import type { WatchTimePerWeekDayByType } from "@/lib/watch-time-per-week-day";

const chartConfig = {
  Episode: {
    label: "TV episodes",
    color: "hsl(var(--chart-1))",
  },
  Movie: {
    label: "Movies",
    color: "hsl(var(--chart-5))",
  },
  Music: {
    label: "Music",
    color: "hsl(var(--chart-2))",
  },
  Other: {
    label: "Other",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

interface Props {
  data: WatchTimePerWeekDayByType[];
}

export const WatchTimePerDay: React.FC<Props> = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch Time Per Day</CardTitle>
        <CardDescription>
          Total watch time for each day of the week, split by media type
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          id="watch-time-per-day"
          config={chartConfig}
          className="h-[300px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={72}
                tickFormatter={(value) =>
                  formatDuration(Number(value), "seconds")
                }
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex w-full flex-row items-center justify-between gap-3">
                        <span>
                          {chartConfig[name as keyof typeof chartConfig]
                            ?.label ?? name}
                        </span>
                        <span>{formatDuration(Number(value), "seconds")}</span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="Episode"
                fill={chartConfig.Episode.color}
                stackId="watchTime"
              />
              <Bar
                dataKey="Movie"
                fill={chartConfig.Movie.color}
                stackId="watchTime"
              />
              <Bar
                dataKey="Music"
                fill={chartConfig.Music.color}
                stackId="watchTime"
              />
              <Bar
                dataKey="Other"
                fill={chartConfig.Other.color}
                radius={[4, 4, 0, 0]}
                stackId="watchTime"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
