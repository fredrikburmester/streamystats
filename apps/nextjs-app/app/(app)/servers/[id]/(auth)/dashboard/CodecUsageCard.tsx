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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";
import { FileDigit } from "lucide-react";
import { CategoryStat } from "@/lib/db/transcoding-statistics";
import { CustomBarLabel } from "@/components/ui/CustomBarLabel";
import React from "react";

export const CodecUsageCard = ({
  videoCodecs,
  audioCodecs,
}: {
  videoCodecs: CategoryStat[];
  audioCodecs: CategoryStat[];
}) => {
  const [containerWidth, setContainerWidth] = React.useState(400);
  const codecData = [
    ...videoCodecs.map((item) => ({
      name: `Video: ${item.label}`,
      count: item.count,
    })),
    ...audioCodecs.map((item) => ({
      name: `Audio: ${item.label}`,
      count: item.count,
    })),
  ].filter((item) => item.count > 0);

  const codecConfig = {
    count: {
      label: "Count",
      color: "hsl(var(--chart-2))",
    },
    label: {
      color: "hsl(var(--background))",
    },
  } satisfies ChartConfig;

  // Calculate bar height based on number of items
  const getBarHeight = (dataLength: number) => {
    const minHeightPerBar = 30;
    const maxHeightPerBar = 40;
    return Math.min(
      Math.max(minHeightPerBar, 200 / dataLength),
      maxHeightPerBar
    );
  };

  const maxCount = Math.max(...codecData.map((d) => d.count));

  const total = codecData.reduce((sum, item) => sum + item.count, 0);
  const totalVideoCodec = videoCodecs.reduce(
    (sum, item) => sum + item.count,
    0
  );
  const totalAudioCodec = audioCodecs.reduce(
    (sum, item) => sum + item.count,
    0
  );
  const codecDataWithPercent = codecData.map((item) => ({
    ...item,
    labelWithPercent: `${item.name} - ${
      total > 0 ? ((item.count / total) * 100).toFixed(1) : "0.0"
    }%`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Codec Usage</CardTitle>
        <CardDescription>Video and audio codec distribution</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={codecConfig}
          className="h-[200px]"
          onWidthChange={setContainerWidth}
        >
          <BarChart
            accessibilityLayer
            data={codecDataWithPercent}
            layout="vertical"
            margin={{
              right: 16,
              left: 0,
              top: 5,
              bottom: 5,
            }}
            barSize={getBarHeight(codecData.length)}
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
            <XAxis dataKey="count" type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
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
          <FileDigit className="h-4 w-4" />
          Video: {totalVideoCodec || "N/A"}, Audio: {totalAudioCodec || "N/A"}
        </div>
      </CardFooter>
    </Card>
  );
};
