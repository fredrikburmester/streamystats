"use client";

import { InfoIcon } from "lucide-react";
import * as React from "react";
import { Pie, PieChart } from "recharts";
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
  const chartData = React.useMemo(() => {
    return data
      .filter((item) => item.count > 0)
      .map((item, index) => ({
        reason: cleanReasonLabel(item.label),
        count: item.count,
        fill: `var(--color-reason-${index})`,
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const chartConfig = {
    count: { label: "Sessions" },
    ...Object.fromEntries(
      chartData.map((item, index) => [
        `reason-${index}`,
        {
          label: item.reason,
          color: [`hsl(var(--chart-1))`, `hsl(var(--chart-2))`, `hsl(var(--chart-3))`, `hsl(var(--chart-4))`, `hsl(var(--chart-5))`, "#ef4444", "#f59e0b"][index % 7],
        },
      ])
    ),
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transcoding Reasons</CardTitle>
          <CardDescription>No transcoding reasons recorded</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          No data to display
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Transcoding Reasons</CardTitle>
        <CardDescription>Why content is being transcoded</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[400px]"
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="reason"
              innerRadius={60}
              strokeWidth={2}
            />
            <ChartLegend
              content={<ChartLegendContent nameKey="reason" />}
              className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none text-muted-foreground">
          <InfoIcon className="h-4 w-4" />
          Top reason: {chartData[0].reason}
        </div>
      </CardFooter>
    </Card>
  );
};
