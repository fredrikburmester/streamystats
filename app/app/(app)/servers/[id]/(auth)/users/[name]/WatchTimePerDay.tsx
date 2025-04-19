"use client";

import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

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
import { User } from "@/lib/db";
import { useMemo } from "react";

const chartConfig = {
  minutes: {
    label: "minutes",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface Props {
  data: User["watch_time_per_day"];
}

export const WatchTimePerDay: React.FC<Props> = ({ data }) => {
  const formattedData = useMemo(
    () =>
      data.map((item) => ({
        date: new Date(item.date).toLocaleDateString(),
        minutes: Math.floor(item.total_duration / 60),
      })),
    [data],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch Time Per Day</CardTitle>
        <CardDescription></CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={formattedData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey="minutes"
              fill="#2761D9"
              radius={8}
              name={"Minutes"}
              label={"Minutes"}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
      {/* <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 font-medium leading-none">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Showing total visitors for the last 6 months
        </div>
      </CardFooter> */}
    </Card>
  );
};
