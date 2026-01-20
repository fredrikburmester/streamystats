"use client";

import { ZapIcon } from "lucide-react";
import React from "react";
import { RadialBar, RadialBarChart } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CategoryStat } from "@/lib/db/transcoding-statistics";

type Props = {
  data: CategoryStat[];
};

const ENGINE_LABELS: Record<string, string> = {
  none: "Software",
  amf: "AMD (AMF)",
  nvenc: "NVIDIA (NVENC)",
  qsv: "Intel (QSV)",
  vaapi: "VAAPI",
  rkmpp: "Rockchip (RKMP)",
  videotoolbox: "Apple (VT)",
  v4l2m2m: "Video4Linux2 (V4L2)",
};

export const HardwareAccelerationCard = ({ data }: Props) => {
  const activeEngines = React.useMemo(() =>
    data.filter((item) => item.count > 0).sort((a, b) => b.count - a.count),
    [data]);

  const totalSessions = React.useMemo(
    () => activeEngines.reduce((sum, item) => sum + item.count, 0),
    [activeEngines]
  );

  const chartData = React.useMemo(() => {
    return activeEngines.map((item, index) => ({
      engine: item.label,
      name: ENGINE_LABELS[item.label.toLowerCase()] || item.label,
      count: item.count,
      fill: `var(--color-engine-${index})`,
    }));
  }, [activeEngines]);

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {
      count: {
        label: "Sessions",
      }
    };
    activeEngines.forEach((item, index) => {
      config[`engine-${index}`] = {
        label: ENGINE_LABELS[item.label.toLowerCase()] || item.label,
        color: [
          "hsl(var(--chart-1))",
          "hsl(var(--chart-2))",
          "hsl(var(--chart-3))",
          "hsl(var(--chart-4))",
          "hsl(var(--chart-5))",
          "#ec4899",
          "#8b5cf6",
        ][index % 7],
      };
    });
    return config;
  }, [activeEngines]);

  if (activeEngines.length === 0) {
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

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Hardware Acceleration</CardTitle>
        <CardDescription>Engine power distribution</CardDescription>
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
            barSize={12}
          >
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="name" />}
            />
            <RadialBar
              dataKey="count"
              background
              cornerRadius={10}
            />
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="flex-wrap gap-2 justify-center"
            />
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm pt-4">
        <div className="flex items-center gap-2 font-medium leading-none">
          <ZapIcon className="h-4 w-4 text-amber-500" />
          Active across {totalSessions} sessions
        </div>
        <div className="leading-none text-muted-foreground">
          Concentric rings show engine dominance
        </div>
      </CardFooter>
    </Card>
  );
};
