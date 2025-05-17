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
  ResponsiveContainer,
} from "recharts";
import { InfoIcon } from "lucide-react";
import { DirectnessStat } from "@/lib/db/transcoding-statistics";
import { CustomBarLabel, CustomValueLabel } from "@/components/ui/CustomBarLabel";

interface DirectnessCardProps {
  data: DirectnessStat[];
}

export const DirectnessCard = ({ data }: DirectnessCardProps) => {
  const directnessConfig = {
    count: {
      label: "Count",
      color: "hsl(var(--chart-2))",
    },
    label: {
      color: "hsl(var(--background))",
    },
  } satisfies ChartConfig;

  const directnessData = data
    .map((item) => ({
      name: item.label,
      count: item.count,
    }))
    .filter((item) => item.count > 0);

  const maxCount = Math.max(...directnessData.map((d) => d.count));

  const total = directnessData.reduce((sum, item) => sum + item.count, 0);
  const directnessDataWithPercent = directnessData.map(item => ({
    ...item,
    percent: total > 0 ? ((item.count / total) * 100) : 0,
    labelWithPercent: `${item.name} - ${(total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0')}%`,
  }));

  // Calculate bar height based on number of items
  const getBarHeight = (dataLength: number) => {
    const minHeightPerBar = 30;
    const maxHeightPerBar = 40;
    return Math.min(
      Math.max(minHeightPerBar, 200 / dataLength),
      maxHeightPerBar
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcoding Directness</CardTitle>
        <CardDescription>
          How often content plays directly vs transcoded
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={directnessConfig} className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              accessibilityLayer
              data={directnessDataWithPercent}
              layout="vertical"
              margin={{
                right: 16,
                left: 0,
                top: 5,
                bottom: 5,
              }}
              barSize={getBarHeight(directnessData.length)}
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
                  content={({ x, y, width, height, value }) => (
                    <CustomBarLabel
                      x={Number(x)}
                      y={Number(y)}
                      width={Number(width)}
                      height={Number(height)}
                      value={value}
                      fill="#d6e3ff"
                      fontSize={12}
                      containerWidth={400}
                      alwaysOutside
                    />
                  )}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        {data.length > 0 ? (
          <div className="flex items-center gap-2">
            <InfoIcon className="h-4 w-4" />
            {data[0]?.label}: {data[0]?.percentage}%
          </div>
        ) : (
          <div>No transcoding data available</div>
        )}
      </CardFooter>
    </Card>
  );
};
