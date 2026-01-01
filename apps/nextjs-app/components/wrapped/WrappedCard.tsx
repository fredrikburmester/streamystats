"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WrappedGradient =
  | "purple"
  | "blue"
  | "amber"
  | "emerald"
  | "rose"
  | "violet"
  | "indigo"
  | "cyan"
  | "pink"
  | "neutral";

const gradientClasses: Record<WrappedGradient, string> = {
  purple: "from-purple-600 via-purple-500 to-pink-500",
  blue: "from-blue-600 via-blue-500 to-cyan-500",
  amber: "from-amber-500 via-orange-500 to-red-500",
  emerald: "from-emerald-500 via-teal-500 to-cyan-500",
  rose: "from-rose-500 via-pink-500 to-purple-500",
  violet: "from-violet-600 via-purple-500 to-indigo-500",
  indigo: "from-indigo-600 via-blue-500 to-purple-500",
  cyan: "from-cyan-500 via-teal-500 to-emerald-500",
  pink: "from-pink-500 via-rose-500 to-red-500",
  neutral: "from-zinc-800 via-zinc-700 to-zinc-600",
};

interface WrappedCardProps {
  children: ReactNode;
  gradient?: WrappedGradient;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function WrappedCard({
  children,
  gradient = "neutral",
  className,
  title,
  subtitle,
}: WrappedCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 md:p-8",
        "bg-gradient-to-br",
        gradientClasses[gradient],
        "text-white shadow-xl",
        className
      )}
    >
      {(title || subtitle) && (
        <div className="mb-6">
          {title && (
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-1 text-sm md:text-base text-white/80">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
