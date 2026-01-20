"use client";

import { ZapIcon } from "lucide-react";
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
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
import type { NumericStat } from "@/lib/db/transcoding-statistics";

interface BitrateDistributionCardProps {
  data: NumericStat;
}

interface BitrateRange {
  range: string;
  count: number;
}

export const BitrateDistributionCard = ({
  data,
}: BitrateDistributionCardProps) => {
  const formatBitrate = (value: number | null) => {
    if (value === null) return "0 Mbps";
    return `${(value / 1000000).toFixed(1)} Mbps`;
  };

  const bitrateData = React.useMemo(() => {
    if (!data.distribution || data.distribution.length === 0) return [];

    const ranges = [
      { label: "0-0.5", min: 0, max: 500000 },
      { label: "0.5-1", min: 500001, max: 1000000 },
      { label: "1-2", min: 1000001, max: 2000000 },
      { label: "2-4", min: 2000001, max: 4000000 },
      { label: "4-6", min: 4000001, max: 6000000 },
      { label: "6-8", min: 6000001, max: 8000000 },
      { label: "8+", min: 8000001, max: Number.POSITIVE_INFINITY },
    ];

    return ranges
      .map((range) => {
        const valuesInRange = data.distribution!.filter(
          (b) => b >= range.min && b <= range.max,
        );
        return {
          range: range.label,
          count: valuesInRange.length,
        };
      })
      .filter((item) => item.count > 0);
  }, [data.distribution]);

  const bitrateConfig = {
    count: {
      label: "Count",
    },
  } satisfies ChartConfig;

  // Modern vibrant colors
  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "#3b82f6",
    "#8b5cf6",
  ];

  const mostCommonCategory = bitrateData.length > 0 
    ? [...bitrateData].sort((a, b) => b.count - a.count)[0].range 
    : "N/A";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bitrate Distribution</CardTitle>
        <CardDescription>
          Avg: {formatBitrate(data.avg ?? 0)} | Max: {formatBitrate(data.max ?? 0)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {bitrateData.length > 0 ? (
          <ChartContainer
            config={bitrateConfig}
            className="h-[200px] w-full"
          >
            <BarChart
              accessibilityLayer
              data={bitrateData}
              margin={{
                top: 20,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="range"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis hide />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar dataKey="count" radius={8}>
                {bitrateData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            No bitrate data available
          </div>
        )}
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <ZapIcon className="h-4 w-4" />
          {bitrateData.length > 0 ? (
            <>Peak range: {mostCommonCategory} Mbps</>
          ) : (
            <>Data from {data.count} sessions</>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};
