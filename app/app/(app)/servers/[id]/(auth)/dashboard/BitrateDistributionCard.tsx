"use client";

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
import { NumericStat } from "@/lib/db/transcoding-statistics";
import { ZapIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import { CustomBarLabel, CustomValueLabel } from "@/components/ui/CustomBarLabel";
import React from "react";

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

  // Use all distribution categories, even those with zero count
  // to show the complete range of possible bitrates
  const bitrateData = data.distribution.filter((item) => item.count > 0);

  const bitrateConfig = {
    count: {
      label: "Count",
      color: "hsl(var(--chart-3))",
    },
    label: {
      color: "hsl(var(--background))",
    },
  } satisfies ChartConfig;

  const getBarHeight = (dataLength: number) => {
    // Adjust for a fixed number of categories, to keep bar sizes consistent
    const fixedLength = Math.max(dataLength, 3); // Use at least 3 as divisor
    const minHeightPerBar = 25;
    const maxHeightPerBar = 35;
    return Math.min(
      Math.max(minHeightPerBar, 200 / fixedLength),
      maxHeightPerBar
    );
  };

  // Find categories with data for the footer
  const categoriesWithData = bitrateData
    .sort((a, b) => b.count - a.count);

  const mostCommonCategory =
    categoriesWithData.length > 0 ? categoriesWithData[0].range : "N/A";

  const maxCount = Math.max(...bitrateData.map((d) => d.count));

  const total = bitrateData.reduce((sum, item) => sum + item.count, 0);
  const bitrateDataWithPercent = bitrateData.map(item => ({
    ...item,
    labelWithPercent: `${item.range} - ${(total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0')}%`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bitrate Distribution</CardTitle>
        <CardDescription>
          Avg: {formatBitrate(data.avg ?? 0)} | Min: {formatBitrate(data.min)} |
          Max: {formatBitrate(data.max)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={bitrateConfig}
          className="h-[200px]"
          onWidthChange={setContainerWidth}
        >
          <BarChart
            accessibilityLayer
            data={bitrateDataWithPercent}
            layout="vertical"
            margin={{
              right: 16,
              left: 0,
              top: 5,
              bottom: 5,
            }}
            barSize={getBarHeight(bitrateData.length)}
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
            <Bar
              dataKey="count"
              layout="vertical"
              radius={4}
              className="fill-blue-600"
            >
              <LabelList
                dataKey="labelWithPercent"
                content={({ x, y, width: barWidth, height, value }) => (
                  <CustomBarLabel
                    x={Number(x)}
                    y={Number(y)}
                    width={Number(barWidth)}
                    height={Number(height)}
                    value={value}
                    fill="#d6e3ff"
                    fontSize={12}
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
          <ZapIcon className="h-4 w-4" />
          Most common: {mostCommonCategory}
        </div>
      </CardFooter>
    </Card>
  );
};
