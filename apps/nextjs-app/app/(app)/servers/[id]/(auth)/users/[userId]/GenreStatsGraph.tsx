"use client";

import { useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { Settings2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { GenreStat } from "@/lib/db/users";
import { cn, formatDuration } from "@/lib/utils";

const chartConfig = {
  total_duration: {
    label: "Total_duration",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  data: GenreStat[];
}

export const GenreStatsGraph: React.FC<Props> = ({
  data,
  className,
  ...props
}) => {
  const [limit, setLimit] = useState(12);
  const [power, setPower] = useState(0.6);

  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.watchTime - a.watchTime);
    const topGenres = sorted.slice(0, limit);

    // "Balance" the sort for a better shape (Center the largest, then alternate)
    // Result: [4, 2, 0, 1, 3, 5] (indices from sorted array)
    const balanced: typeof topGenres = [];

    // Place the largest item at the top/center (depending on radar start angle, usually top)
    if (topGenres.length > 0) {
      balanced.push(topGenres[0]);
    }

    // Alternate adding to the array to distribute magnitude
    for (let i = 1; i < topGenres.length; i++) {
      if (i % 2 === 1) {
        // Add to the right (or end of array)
        balanced.push(topGenres[i]);
      } else {
        // Add to the left (or beginning of array)
        balanced.unshift(topGenres[i]);
      }
    }

    return balanced.map((item) => ({
      ...item,
      normalizedWatchTime: item.watchTime ** power,
    }));
  }, [data, limit, power]);

  return (
    <Card {...props} className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-semibold leading-none tracking-tight">
          Most Watched Genres
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings2 className="h-4 w-4" />
              <span className="sr-only">Open settings</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Chart Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Customize the appearance of the radar chart.
                </p>
              </div>
              <div className="grid gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="limit">Top Genres Limit</Label>
                    <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                      {limit}
                    </span>
                  </div>
                  <Slider
                    id="limit"
                    min={3}
                    max={20}
                    step={1}
                    value={[limit]}
                    onValueChange={(vals) => setLimit(vals[0])}
                    className="w-full"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="power">Normalization Power</Label>
                    <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                      {power}
                    </span>
                  </div>
                  <Slider
                    id="power"
                    min={0.1}
                    max={1.5}
                    step={0.1}
                    value={[power]}
                    onValueChange={(vals) => setPower(vals[0])}
                    className="w-full"
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    Lower values flatten the curve, making small genres more visible.
                  </p>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="pb-0">
        <ChartContainer
          id="genre-stats"
          config={chartConfig}
          className="h-[300px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              data={chartData}
              outerRadius={90}
              startAngle={180}
              endAngle={-180}
            >
              <PolarGrid />
              <PolarAngleAxis
                dataKey="genre"
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <Radar
                name="Watch Time"
                dataKey="normalizedWatchTime"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.6}
                dot={{
                  r: 4,
                  fillOpacity: 1,
                }}
              />
              <ChartTooltip
                formatter={(val, name, item) => (
                  <div>
                    <p>{formatDuration(item.payload.watchTime)}</p>
                  </div>
                )}
                cursor={false}
                content={<ChartTooltipContent />}
              />
            </RadarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
