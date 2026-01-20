"use client";

import { InfoIcon } from "lucide-react";
import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
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
import type { DirectnessStat } from "@/lib/db/transcoding-statistics";

interface DirectnessCardProps {
  data: DirectnessStat[];
}

export const DirectnessCard = ({ data }: DirectnessCardProps) => {
  const directnessData = React.useMemo(() => {
    return data
      .map((item, index) => ({
        name: item.label,
        count: item.count,
        fill: `var(--color-${item.label.toLowerCase().includes("direct") ? "direct" : "transcode"})`,
      }))
      .filter((item) => item.count > 0);
  }, [data]);

  const total = React.useMemo(
    () => directnessData.reduce((sum, item) => sum + item.count, 0),
    [directnessData],
  );

  const directPlayItem = directnessData.find((d) =>
    d.name.toLowerCase().includes("direct"),
  );
  const directPlayPercent = total > 0 ? ((directPlayItem?.count || 0) / total) * 100 : 0;

  const directnessConfig = {
    count: {
      label: "Sessions",
    },
    direct: {
      label: "Direct Play",
      color: "hsl(var(--chart-2))",
    },
    transcode: {
      label: "Transcode",
      color: "hsl(var(--chart-4))",
    },
  } satisfies ChartConfig;

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Transcoding Directness</CardTitle>
        <CardDescription>
          Direct Play vs Transcoding
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={directnessConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={directnessData}
              dataKey="count"
              nameKey="name"
              innerRadius={60}
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {directPlayPercent.toFixed(0)}%
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Direct
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          {directPlayPercent > 50 ? "Mostly Direct Play" : "Mostly Transcoding"}
        </div>
        <div className="flex items-center gap-2 leading-none text-muted-foreground">
          <InfoIcon className="h-4 w-4" />
          Total sessions: {total}
        </div>
      </CardFooter>
    </Card>
  );
};
