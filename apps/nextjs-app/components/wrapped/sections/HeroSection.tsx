"use client";

import { Star } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

interface HeroSectionProps {
  year: number;
  userName: string;
  availableYears: number[];
  serverId: number;
  userId?: string;
}

function StarIcon({ className }: { className?: string }) {
  return <Star className={className} fill="currentColor" strokeWidth={0} />;
}

function YearTimeline({
  years,
  currentYear,
  getYearUrl,
}: {
  years: number[];
  currentYear: number;
  getYearUrl: (y: number) => string;
}) {
  const sortedYears = [...years].sort((a, b) => a - b);
  const minYear = sortedYears[0];
  const maxYear = sortedYears[sortedYears.length - 1];
  const displayYears: number[] = [];
  for (let y = minYear - 3; y <= maxYear + 3; y++) {
    displayYears.push(y);
  }

  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="flex items-center justify-center gap-4 md:gap-6 py-4"
      >
        {displayYears.map((y) => {
          const isAvailable = sortedYears.includes(y);
          const isCurrent = y === currentYear;

          return (
            <div key={y} className="flex flex-col items-center gap-2">
              {isCurrent && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-0.5"
                >
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-1 h-1 rounded-full bg-blue-400" />
                  ))}
                </motion.div>
              )}
              {isAvailable ? (
                <Link
                  href={getYearUrl(y)}
                  className={`text-sm md:text-base font-semibold transition-all duration-300 ${
                    isCurrent
                      ? "text-white text-lg md:text-xl scale-110"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {y}
                </Link>
              ) : (
                <span className="text-sm md:text-base text-white/15 font-medium">
                  {y}
                </span>
              )}
            </div>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent origin-center"
      />
    </div>
  );
}

export function HeroSection({
  year,
  userName,
  availableYears,
  serverId,
  userId,
}: HeroSectionProps) {
  const getYearUrl = (y: number) => {
    const basePath = `/servers/${serverId}/wrapped/${y}`;
    return userId ? `${basePath}/${userId}` : basePath;
  };

  return (
    <section className="relative min-h-[90vh] flex flex-col overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 via-background to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/15 via-transparent to-transparent" />

      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="flex-1 flex flex-col items-center justify-center relative px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        >
          <div className="relative">
            <span
              className="text-[16rem] sm:text-[20rem] md:text-[28rem] lg:text-[36rem] font-black leading-none tracking-tighter"
              style={{
                WebkitTextStroke: "2px rgba(59, 130, 246, 0.15)",
                WebkitTextFillColor: "transparent",
              }}
            >
              {year}
            </span>
            <span className="absolute inset-0 text-[16rem] sm:text-[20rem] md:text-[28rem] lg:text-[36rem] font-black leading-none tracking-tighter bg-gradient-to-b from-blue-500/10 to-transparent bg-clip-text text-transparent blur-sm">
              {year}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative z-10 flex items-center gap-3 mb-6"
        >
          <StarIcon className="w-3 h-3 text-blue-400/80" />
          <StarIcon className="w-4 h-4 text-blue-400" />
          <span className="text-blue-400 font-bold text-2xl md:text-3xl tracking-wider">
            {year}
          </span>
          <StarIcon className="w-4 h-4 text-blue-400" />
          <StarIcon className="w-3 h-3 text-blue-400/80" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="relative z-10 text-center"
        >
          <p className="text-base md:text-lg text-white/50 mb-3 tracking-wide uppercase">
            Welcome to {userName === "your" ? "your" : `${userName}'s`}
          </p>
          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-black tracking-tight uppercase"
            style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            <span className="block bg-gradient-to-b from-white via-white to-white/80 bg-clip-text text-transparent drop-shadow-2xl">
              Year in
            </span>
            <span className="block bg-gradient-to-b from-white/90 via-white/80 to-white/60 bg-clip-text text-transparent">
              Review
            </span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="relative z-10 mt-8 flex items-center gap-2"
        >
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/30" />
          <span className="text-xs text-white/40 tracking-[0.3em] uppercase">
            Scroll to explore
          </span>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/30" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
            className="w-5 h-8 rounded-full border border-white/20 flex justify-center pt-1.5"
          >
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3], y: [0, 8, 0] }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
              className="w-1 h-1 rounded-full bg-white/60"
            />
          </motion.div>
        </motion.div>
      </div>

      <div className="relative z-10">
        <YearTimeline
          years={availableYears}
          currentYear={year}
          getYearUrl={getYearUrl}
        />
      </div>
    </section>
  );
}
