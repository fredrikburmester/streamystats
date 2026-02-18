"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { TranscodingHistoryStat } from "@/lib/db/transcoding-statistics";

interface Props {
  data: TranscodingHistoryStat[];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#e11d48",
];

export const TranscodingReasonsHistoryCard: React.FC<Props> = ({ data }) => {
  const { chartData, reasons, chartConfig } = useMemo(() => {
    // Collect all unique reasons
    const uniqueReasons = new Set<string>();
    data.forEach((day) => {
      Object.keys(day.reasons).forEach((reason) => {
        uniqueReasons.add(reason);
      });
    });
    const reasonsList = Array.from(uniqueReasons).sort();

    // Prepare chart configuration and colors
    const config: ChartConfig = {};
    reasonsList.forEach((reason, index) => {
      config[reason] = {
        label: cleanReasonLabel(reason),
        color: COLORS[index % COLORS.length],
      };
    });

    // Flatten data for Recharts
    const flattenedData = data.map((day) => {
      const flattened: Record<string, string | number> = { date: day.date };
      reasonsList.forEach((reason) => {
        flattened[reason] = day.reasons[reason] || 0;
      });
      return flattened;
    });

    return {
      chartData: flattenedData,
      reasons: reasonsList,
      chartConfig: config,
    };
  }, [data]);

  if (reasons.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcoding Reasons Over Time</CardTitle>
        <CardDescription>
          Breakdown of why transcoding happened per day
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[350px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => {
                  return new Date(value).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              {reasons.map((reason) => (
                <Bar
                  key={reason}
                  dataKey={reason}
                  stackId="a"
                  fill={`var(--color-${reason})`}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

function cleanReasonLabel(label: string): string {
  if (label.startsWith("[") && label.endsWith("]")) {
    try {
      const parsed = JSON.parse(label);
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch (_error) {}
  }
  return label;
}
