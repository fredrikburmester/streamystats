"use client";

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

const chartConfig = {
  directPlay: {
    label: "Direct Play",
    color: "hsl(var(--chart-2))",
  },
  transcode: {
    label: "Transcode",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface Props {
  data: TranscodingHistoryStat[];
}

export const TranscodingDirectnessHistoryCard: React.FC<Props> = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Directness Over Time</CardTitle>
        <CardDescription>
          Daily breakdown of Direct Play vs Transcoding sessions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[350px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
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
              <Bar
                dataKey="directPlay"
                stackId="a"
                fill="var(--color-directPlay)"
                radius={[0, 0, 4, 4]}
              />
              <Bar
                dataKey="transcode"
                stackId="a"
                fill="var(--color-transcode)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
