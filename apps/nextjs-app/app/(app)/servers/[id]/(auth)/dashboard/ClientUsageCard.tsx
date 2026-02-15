"use client";

import { InfoIcon } from "lucide-react";
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
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
import type { ClientStat } from "@/lib/db/client-statistics";
import { formatDuration } from "@/lib/utils";

interface ClientUsageCardProps {
  data: ClientStat[];
}

export const ClientUsageCard = ({ data }: ClientUsageCardProps) => {
  const [containerWidth, setContainerWidth] = React.useState(400);

  const usageData = data
    .map((item) => ({
      name: item.clientName || "Unknown",
      watchTime: item.totalWatchTime,
    }))
    .filter((item) => item.watchTime > 0)
    .sort((a, b) => b.watchTime - a.watchTime)
    .slice(0, 10); // Top 10

  const usageConfig = {
    watchTime: {
      label: "Watch Time",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

  const total = usageData.reduce((sum, item) => sum + item.watchTime, 0);
  const usageDataWithPercent = usageData.map((item) => ({
    ...item,
    percent: total > 0 ? (item.watchTime / total) * 100 : 0,
    labelWithPercent: `${item.name} - ${formatDuration(
      item.watchTime,
      "seconds",
    )}`,
  }));

  const getBarHeight = (dataLength: number) => {
    const minHeightPerBar = 30;
    const maxHeightPerBar = 40;
    return Math.min(
      Math.max(minHeightPerBar, 200 / dataLength),
      maxHeightPerBar,
    );
  };

  if (usageData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Client Usage</CardTitle>
          <CardDescription>Watch time per client</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <div className="text-muted-foreground">No usage data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Usage</CardTitle>
        <CardDescription>Watch time per client</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          id="client-usage"
          config={usageConfig}
          className="h-[200px]"
          onWidthChange={setContainerWidth}
        >
          <BarChart
            accessibilityLayer
            data={usageDataWithPercent}
            layout="vertical"
            margin={{
              right: 16,
              left: 0,
              top: 5,
              bottom: 5,
            }}
            barSize={getBarHeight(usageData.length)}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              hide
            />
            <XAxis dataKey="watchTime" type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Bar dataKey="watchTime" radius={4} className="fill-green-600">
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
          <InfoIcon className="h-4 w-4" />
          Total: {formatDuration(total, "seconds")}
        </div>
      </CardFooter>
    </Card>
  );
};
