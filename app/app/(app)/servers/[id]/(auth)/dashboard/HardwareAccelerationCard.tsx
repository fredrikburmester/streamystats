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
import { CategoryStat } from "@/lib/db/transcoding-statistics";
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

type Props = {
  data: CategoryStat[];
};

export const HardwareAccelerationCard = ({ data }: Props) => {
  const [containerWidth, setContainerWidth] = React.useState(400);

  const getBarHeight = (dataLength: number) => {
    const minHeightPerBar = 30;
    const maxHeightPerBar = 40;
    return Math.min(
      Math.max(minHeightPerBar, 200 / dataLength),
      maxHeightPerBar
    );
  };

  const hwAccelData = data
    .map((item) => ({
      name: item.value,
      count: item.count,
    }))
    .filter((item) => item.count > 0);

  const hwAccelConfig = {
    count: {
      label: "Count",
      color: "hsl(var(--chart-1))",
    },
    label: {
      color: "hsl(var(--background))",
    },
  } satisfies ChartConfig;

  const maxCount = Math.max(...hwAccelData.map((d) => d.count));

  const total = hwAccelData.reduce((sum, item) => sum + item.count, 0);
  const hwAccelDataWithPercent = hwAccelData.map(item => ({
    ...item,
    labelWithPercent: `${item.name} - ${(total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0')}%`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hardware Acceleration</CardTitle>
        <CardDescription>
          Acceleration types used for transcoding
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer 
          config={hwAccelConfig} 
          className="h-[200px]"
          onWidthChange={setContainerWidth}
        >
          <BarChart
            accessibilityLayer
            data={hwAccelDataWithPercent}
            layout="vertical"
            margin={{
              right: 16,
              left: 0,
              top: 5,
              bottom: 5,
            }}
            barSize={getBarHeight(hwAccelData.length)}
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
          Primary acceleration: {data[0]?.value || "None"}
        </div>
      </CardFooter>
    </Card>
  );
};
