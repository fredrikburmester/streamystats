"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { GenreStats } from "@/lib/db/wrapped";
import { formatDuration } from "@/lib/utils";

interface WrappedGenreChartProps {
  genres: GenreStats[];
}

const COLORS = [
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#10b981", // emerald
  "#f43f5e", // rose
  "#6366f1", // indigo
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#84cc16", // lime
];

export function WrappedGenreChart({ genres }: WrappedGenreChartProps) {
  const data = genres.slice(0, 8).map((g, index) => ({
    name: g.genre,
    value: g.watchTimeSeconds,
    percentage: g.percentageOfTotal,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percentage }) => `${name} (${percentage}%)`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
                    <p className="font-semibold text-white">{data.name}</p>
                    <p className="text-sm text-zinc-400">
                      {formatDuration(data.value)}
                    </p>
                    <p className="text-sm text-zinc-400">{data.percentage}%</p>
                  </div>
                );
              }
              return null;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
