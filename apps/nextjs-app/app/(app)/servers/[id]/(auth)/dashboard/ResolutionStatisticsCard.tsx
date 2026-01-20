"use client";

import { InfoIcon, MonitorIcon } from "lucide-react";
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Cell,
  LabelList,
} from "recharts";
import { CustomBarLabel } from "@/components/ui/CustomBarLabel";
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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import type { NumericStat } from "@/lib/db/transcoding-statistics";

interface Props {
  width: NumericStat;
  height: NumericStat;
}

const RESOLUTION_COLORS: Record<string, string> = {
  "4K (3840+)": "hsl(var(--chart-5))",
  "1440p (2560+)": "hsl(var(--chart-4))",
  "1080p (1920)": "hsl(var(--chart-1))",
  "720p (1280)": "hsl(var(--chart-2))",
  "SD+ (960+)": "hsl(var(--chart-3))",
  "SD (720+)": "#94a3b8",
  "Low (<720)": "#64748b",
};

function categorizeResolution(width: number): string {
  if (width >= 3840) return "4K (3840+)";
  if (width >= 2560) return "1440p (2560+)";
  if (width >= 1920) return "1080p (1920)";
  if (width >= 1280) return "720p (1280)";
  if (width >= 960) return "SD+ (960+)";
  if (width >= 720) return "SD (720+)";
  return "Low (<720)";
}

export const ResolutionStatisticsCard = ({ width, height }: Props) => {
  const [containerWidth, setContainerWidth] = React.useState(400);

  const chartData = React.useMemo(() => {
    if (!width.distribution || !height.distribution) return [];

    const ranges: Record<string, number> = {};
    const minLength = Math.min(width.distribution.length, height.distribution.length);

    for (let i = 0; i < minLength; i++) {
      const category = categorizeResolution(width.distribution[i]);
      ranges[category] = (ranges[category] || 0) + 1;
    }

    const processed = Object.entries(ranges)
      .map(([range, count]) => ({ range, count, fill: RESOLUTION_COLORS[range] || "hsl(var(--chart-1))" }))
      .sort((a, b) => b.count - a.count);

    const total = processed.reduce((sum, item) => sum + item.count, 0);
    return processed.map(item => ({
      ...item,
      labelWithPercent: `${item.range} - ${total > 0 ? ((item.count / total) * 100).toFixed(1) : "0.0"}%`
    }));
  }, [width.distribution, height.distribution]);

  const chartConfig = {
    count: { label: "Sessions" },
    ...Object.fromEntries(Object.keys(RESOLUTION_COLORS).map(key => [key, { label: key, color: RESOLUTION_COLORS[key] }]))
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resolution Statistics</CardTitle>
          <CardDescription>No resolution data available</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
          No data to display
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resolution Distribution</CardTitle>
        <CardDescription>
          Avg: {width.avg?.toFixed(0)}×{height.avg?.toFixed(0)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="h-[250px] w-full"
          onWidthChange={setContainerWidth}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{
              left: 0,
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="range"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              hide
            />
            <XAxis dataKey="count" type="number" hide />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="count" radius={4} barSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="labelWithPercent"
                content={(props) => (
                  <CustomBarLabel
                    {...props}
                    x={Number(props.x)}
                    y={Number(props.y)}
                    width={Number(props.width)}
                    height={Number(props.height)}
                    value={props.value}
                    fill="hsl(var(--foreground))"
                    fontSize={11}
                    containerWidth={containerWidth}
                    alwaysOutside
                  />
                )}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <MonitorIcon className="h-4 w-4" />
          Dominant: {chartData[0]?.range}
        </div>
      </CardFooter>
    </Card>
  );
};
