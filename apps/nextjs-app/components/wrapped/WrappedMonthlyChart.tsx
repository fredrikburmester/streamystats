"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyTotal } from "@/lib/db/wrapped";
import { formatDuration } from "@/lib/utils";

interface WrappedMonthlyChartProps {
  data: MonthlyTotal[];
}

export function WrappedMonthlyChart({ data }: WrappedMonthlyChartProps) {
  const chartData = data.map((d) => ({
    month: d.monthName.slice(0, 3),
    hours: Math.round(d.watchTimeSeconds / 3600),
    watchTimeSeconds: d.watchTimeSeconds,
  }));

  return (
    <div className="w-full h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <XAxis
            dataKey="month"
            tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
            axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
            axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
            tickLine={false}
            tickFormatter={(value) => `${value}h`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
                    <p className="font-semibold text-white">{data.month}</p>
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
            dataKey="hours"
            fill="rgba(255,255,255,0.3)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
