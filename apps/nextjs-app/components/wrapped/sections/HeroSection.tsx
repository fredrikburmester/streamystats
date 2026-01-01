"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

interface HeroSectionProps {
  year: number;
  userName: string;
  availableYears: number[];
  serverId: number;
  userId?: string;
}

export function HeroSection({
  year,
  userName,
  availableYears,
  serverId,
  userId,
}: HeroSectionProps) {
  const currentIndex = availableYears.indexOf(year);
  const prevYear =
    currentIndex < availableYears.length - 1
      ? availableYears[currentIndex + 1]
      : null;
  const nextYear = currentIndex > 0 ? availableYears[currentIndex - 1] : null;

  const getYearUrl = (y: number) => {
    const basePath = `/servers/${serverId}/wrapped/${y}`;
    return userId ? `${basePath}/${userId}` : basePath;
  };

  return (
    <section className="relative min-h-[80vh] flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 via-transparent to-transparent" />

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      >
        <span className="text-[20rem] md:text-[30rem] font-black text-blue-500/10 leading-none tracking-tighter">
          {year}
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative z-10 flex items-center gap-2 mb-8"
      >
        {prevYear ? (
          <Link
            href={getYearUrl(prevYear)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white/60" />
          </Link>
        ) : (
          <div className="w-9" />
        )}

        <div className="px-4 py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm">
          <span className="text-sm font-medium text-white/90">{year}</span>
          <span className="text-xs text-white/50 ml-2">YEAR IN REVIEW</span>
        </div>

        {nextYear ? (
          <Link
            href={getYearUrl(nextYear)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-white/60" />
          </Link>
        ) : (
          <div className="w-9" />
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="relative z-10 text-center px-4"
      >
        <p className="text-lg md:text-xl text-white/70 mb-2">
          Welcome to {userName === "your" ? "your" : `${userName}'s`}
        </p>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-white via-blue-200 to-blue-400 bg-clip-text text-transparent">
            Year in
          </span>
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-white bg-clip-text text-transparent">
            Review
          </span>
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
          className="w-6 h-10 rounded-full border-2 border-white/30 flex justify-center pt-2"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
        </motion.div>
      </motion.div>
    </section>
  );
}
