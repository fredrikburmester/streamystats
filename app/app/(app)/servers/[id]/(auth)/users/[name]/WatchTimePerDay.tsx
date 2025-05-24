"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
} from "recharts";

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
import { useMemo } from "react";

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const chartConfig = {
  total_duration: {
    label: "Watch Time",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface Props {
  data: { day_of_week: number; total_duration: number }[];
}

export const WatchTimePerDay: React.FC<Props> = ({ data }) => {
  // Ensure all days are present (fill missing with 0)
  const formattedData = useMemo(() => {
    const dayMap = new Map<number, number>();
    data.forEach((item) => {
      dayMap.set(Number(item.day_of_week), item.total_duration);
    });
    return Array.from({ length: 7 }, (_, i) => {
      const day = i + 1; // 1=Mon, ..., 7=Sun
      return {
        day: dayNames[i],
        minutes: Math.floor((dayMap.get(day) || 0) / 60),
        dayNumber: day,
      };
    });
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch Time Per Day</CardTitle>
        <CardDescription>
          Showing total watch time for each day of the week (Mon-Sun)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip
                cursor={false}
                formatter={(val) => (
                  <div>
                    <p>{formatDuration(Number(val), "minutes")}</p>
                  </div>
                )}
                content={<ChartTooltipContent />}
              />
              <Bar
                dataKey="minutes"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
                name="Watch Time (min)"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
      {/* <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 font-medium leading-none">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Showing total visitors for the last 6 months
        </div>
      </CardFooter> */}
    </Card>
  );
};
