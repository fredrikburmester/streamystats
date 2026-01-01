"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { MonthlyTotal } from "@/lib/db/wrapped";
import { formatDuration } from "@/lib/utils";

interface WrappedMonthlyChartProps {
  data: MonthlyTotal[];
}

const CHART_PRIMARY = "#1D4ED8";

const chartConfig = {
  hours: {
    label: "Hours",
    color: CHART_PRIMARY,
  },
} satisfies ChartConfig;

export function WrappedMonthlyChart({ data }: WrappedMonthlyChartProps) {
  const chartData = data.map((d) => ({
    month: d.monthName.slice(0, 3),
    hours: Math.round(d.watchTimeSeconds / 3600),
    watchTimeSeconds: d.watchTimeSeconds,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <BarChart data={chartData}>
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          fontSize={12}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          tickFormatter={(value) => `${value}h`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{item.payload.month}</span>
                  <span className="text-muted-foreground">
                    {formatDuration(item.payload.watchTimeSeconds)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="hours"
          fill={CHART_PRIMARY}
          opacity={0.7}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
