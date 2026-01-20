"use client";

import { ZapIcon } from "lucide-react";
import React from "react";
import { RadialBar, RadialBarChart, PolarGrid } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { CategoryStat } from "@/lib/db/transcoding-statistics";

type Props = {
  data: CategoryStat[];
};

export const HardwareAccelerationCard = ({ data }: Props) => {
  const chartData = React.useMemo(() => {
    return data
      .filter((item) => item.count > 0)
      .map((item, index) => ({
        name: item.label,
        count: item.count,
        fill: `var(--color-type-${index})`,
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const chartConfig = {
    count: { label: "Sessions" },
    ...Object.fromEntries(
      chartData.map((item, index) => [
        `type-${index}`,
        {
          label: item.name,
          color: [`hsl(var(--chart-1))`, `hsl(var(--chart-2))`, `hsl(var(--chart-3))`, `hsl(var(--chart-4))`, `hsl(var(--chart-5))`][index % 5],
        },
      ])
    ),
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hardware Acceleration</CardTitle>
          <CardDescription>No acceleration data available</CardDescription>
        </CardHeader>
        <CardContent className="h-[250px] flex items-center justify-center text-muted-foreground">
          No data to display
        </CardContent>
      </Card>
    );
  }

  const primaryType = chartData[0].name;

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Hardware Acceleration</CardTitle>
        <CardDescription>Engine distribution</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <RadialBarChart
            data={chartData}
            innerRadius={30}
            outerRadius={110}
            barSize={10}
          >
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="name" />}
            />
            <PolarGrid gridType="circle" />
            <RadialBar
              dataKey="count"
              background
              cornerRadius={5}
            />
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          Most used: {primaryType}
        </div>
        <div className="flex items-center gap-2 leading-none text-muted-foreground">
          <ZapIcon className="h-4 w-4" />
          Acceleration engine effectiveness
        </div>
      </CardFooter>
    </Card>
  );
};
