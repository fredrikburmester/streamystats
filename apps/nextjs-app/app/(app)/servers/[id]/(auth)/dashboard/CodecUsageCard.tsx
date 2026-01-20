"use client";

import { FileDigit } from "lucide-react";
import React from "react";
import { Pie, PieChart, Cell } from "recharts";
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

export const CodecUsageCard = ({
  videoCodecs,
  audioCodecs,
}: {
  videoCodecs: CategoryStat[];
  audioCodecs: CategoryStat[];
}) => {
  const videoData = React.useMemo(() => 
    videoCodecs.filter(c => c.count > 0).map((c, i) => ({ ...c, fill: `var(--color-v-${i})` })),
    [videoCodecs]
  );
  
  const audioData = React.useMemo(() => 
    audioCodecs.filter(c => c.count > 0).map((c, i) => ({ ...c, fill: `var(--color-a-${i})` })),
    [audioCodecs]
  );

  const chartConfig = {
    count: { label: "Sessions" },
    ...Object.fromEntries(videoData.map((c, i) => [`v-${i}`, { label: c.label, color: ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-5))"][i % 3] }])),
    ...Object.fromEntries(audioData.map((c, i) => [`a-${i}`, { label: c.label, color: ["hsl(var(--chart-3))", "hsl(var(--chart-4))", "#ec4899"][i % 3] }])),
  } satisfies ChartConfig;

  const totalVideo = videoData.reduce((sum, c) => sum + c.count, 0);
  const totalAudio = audioData.reduce((sum, c) => sum + c.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Codec Distribution</CardTitle>
        <CardDescription>Video and Audio formats used</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-row justify-around py-4">
        <div className="flex flex-col items-center">
          <ChartContainer config={chartConfig} className="aspect-square h-[140px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={videoData}
                dataKey="count"
                nameKey="label"
                innerRadius={35}
                outerRadius={55}
                strokeWidth={2}
              />
            </PieChart>
          </ChartContainer>
          <span className="text-xs font-medium mt-2">Video Codecs</span>
        </div>
        
        <div className="flex flex-col items-center">
          <ChartContainer config={chartConfig} className="aspect-square h-[140px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={audioData}
                dataKey="count"
                nameKey="label"
                innerRadius={35}
                outerRadius={55}
                strokeWidth={2}
              />
            </PieChart>
          </ChartContainer>
          <span className="text-xs font-medium mt-2">Audio Codecs</span>
        </div>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <FileDigit className="h-4 w-4" />
          {totalVideo} Video / {totalAudio} Audio sessions
        </div>
      </CardFooter>
    </Card>
  );
};
