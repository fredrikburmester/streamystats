"use client";

import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer } from "recharts";

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
import { User } from "@/lib/db";
import { useMemo } from "react";
import { formatDuration } from "@/lib/utils";

const chartConfig = {
  total_duration: {
    label: "Watch Time",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface Props {
  data: User["watch_time_per_day"];
}

export const WatchTimePerDay: React.FC<Props> = ({ data }) => {
  const formattedData = useMemo(
    () =>
      data.map((item) => ({
        date: new Date(item.date).toLocaleDateString(),
        total_duration: item.total_duration,
      })),
    [data],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch Time Per Day</CardTitle>
        <CardDescription></CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tick={{ fontSize: 12 }}
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
                          <span className="font-mono ml-2">{formatDuration(Number(entry.value))}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="total_duration"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
                name="Watch Time"
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
