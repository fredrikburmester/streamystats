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
} from "@/components/ui/chart";
import type { NumericStat } from "@/lib/db/transcoding-statistics";

interface BitrateDistributionCardProps {
  data: NumericStat;
}

export const BitrateDistributionCard = ({
  data,
}: BitrateDistributionCardProps) => {
  const [containerWidth, setContainerWidth] = React.useState(400);

  const formatBitrate = (value: number | null) => {
    if (value === null) return "0 Mbps";
    return `${(value / 1000000).toFixed(1)} Mbps`;
  };

  const bitrateData = React.useMemo(() => {
    if (!data.distribution || data.distribution.length === 0) return [];

    const ranges = [
      { label: "0-2", min: 0, max: 2000000 },
      { label: "2-4", min: 2000001, max: 4000000 },
      { label: "4-8", min: 4000001, max: 8000000 },
      { label: "8-12", min: 8000001, max: 12000000 },
      { label: "12-24", min: 12000001, max: 24000000 },
      { label: "24+", min: 24000001, max: Number.POSITIVE_INFINITY },
    ];

    const processed = ranges
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

    const total = processed.reduce((sum, item) => sum + item.count, 0);
    return processed.map(item => ({
      ...item,
      labelWithPercent: `${item.range} Mbps - ${total > 0 ? ((item.count / total) * 100).toFixed(1) : "0.0"}%`
    }));
  }, [data.distribution]);

  const bitrateConfig = {
    count: {
      label: "Count",
    },
  } satisfies ChartConfig;

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
            className="h-[250px] w-full"
            onWidthChange={setContainerWidth}
          >
            <BarChart
              accessibilityLayer
              data={bitrateData}
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
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar dataKey="count" radius={4} barSize={24}>
                {bitrateData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
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
