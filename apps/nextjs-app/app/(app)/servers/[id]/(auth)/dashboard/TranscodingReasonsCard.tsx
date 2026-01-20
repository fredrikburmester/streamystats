"use client";

import { InfoIcon } from "lucide-react";
import * as React from "react";
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
import type { CategoryStat } from "@/lib/db/transcoding-statistics";

interface TranscodingReasonsCardProps {
  data: CategoryStat[];
}

function cleanReasonLabel(label: string): string {
  if (label.startsWith("[") && label.endsWith("]")) {
    try {
      const parsed = JSON.parse(label);
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch (_error) {}
  }
  return label;
}

export const TranscodingReasonsCard = ({
  data,
}: TranscodingReasonsCardProps) => {
  const [containerWidth, setContainerWidth] = React.useState(400);

  const chartData = React.useMemo(() => {
    const processed = data
      .filter((item) => item.count > 0)
      .map((item) => ({
        reason: cleanReasonLabel(item.label),
        count: item.count,
      }))
      .sort((a, b) => b.count - a.count);

    const total = processed.reduce((sum, item) => sum + item.count, 0);
    return processed.map((item, index) => ({
      ...item,
      labelWithPercent: `${item.reason} — ${total > 0 ? ((item.count / total) * 100).toFixed(1) : "0.0"}%`,
      fill: [
        "hsl(var(--chart-1))",
        "hsl(var(--chart-2))",
        "hsl(var(--chart-3))",
        "hsl(var(--chart-4))",
        "hsl(var(--chart-5))",
        "#ec4899",
        "#8b5cf6",
      ][index % 7],
    }));
  }, [data]);

  const chartConfig = {
    count: { label: "Sessions" },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transcoding Reasons</CardTitle>
          <CardDescription>No transcoding reasons recorded</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
          No data to display
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Transcoding Reasons</CardTitle>
        <CardDescription>Why content is being transcoded</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="h-[350px] w-full"
          onWidthChange={setContainerWidth}
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{
              left: 0,
              right: 32,
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="reason"
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
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none text-muted-foreground">
          <InfoIcon className="h-4 w-4" />
          Dominant reason: {chartData[0].reason}
        </div>
      </CardFooter>
    </Card>
  );
};
