"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface WrappedStatCardProps {
  value: string | number;
  label: string;
  icon?: LucideIcon;
  className?: string;
}

export function WrappedStatCard({
  value,
  label,
  icon: Icon,
  className,
}: WrappedStatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-4 md:p-6",
        "rounded-xl bg-white/10 backdrop-blur-sm",
        "text-center",
        className
      )}
    >
      {Icon && <Icon className="h-6 w-6 mb-2 text-white/80" />}
      <div className="text-2xl md:text-4xl font-bold tracking-tight">{value}</div>
      <div className="text-xs md:text-sm text-white/80 mt-1">{label}</div>
    </div>
  );
}
