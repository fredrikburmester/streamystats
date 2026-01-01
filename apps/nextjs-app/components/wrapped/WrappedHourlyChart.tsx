"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HourlyPattern } from "@/lib/db/wrapped";
import { formatDuration } from "@/lib/utils";

interface WrappedHourlyChartProps {
  data: HourlyPattern[];
  peakHour: number;
}

export function WrappedHourlyChart({ data, peakHour }: WrappedHourlyChartProps) {
  const chartData = data.map((d) => ({
    hour: `${d.hour.toString().padStart(2, "0")}:00`,
    hourNum: d.hour,
    minutes: Math.round(d.watchTimeSeconds / 60),
    watchTimeSeconds: d.watchTimeSeconds,
    isPeak: d.hour === peakHour,
  }));

  return (
    <div className="w-full h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <XAxis
            dataKey="hour"
            tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
            tickLine={false}
            interval={2}
          />
          <YAxis hide />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
                    <p className="font-semibold text-white">{data.hour}</p>
                    <p className="text-sm text-zinc-400">
                      {formatDuration(data.watchTimeSeconds)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="minutes"
            fill="rgba(255,255,255,0.3)"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
