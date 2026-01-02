"use client";

import { TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import type { GenrePercentile, GenreStats } from "@/lib/db/wrapped";
import { formatDuration } from "@/lib/utils";
import { Highlight, SectionDescription, SubsectionHeader } from "./shared";

interface DominantGenreSectionProps {
  topGenres: GenreStats[];
  genrePercentiles: GenrePercentile[];
  totalGenresExplored: number;
}

export function DominantGenreSection({
  topGenres,
  genrePercentiles,
  totalGenresExplored,
}: DominantGenreSectionProps) {
  if (topGenres.length === 0) return null;

  const dominantGenre = topGenres[0];
  const topPercentile = genrePercentiles.find(
    (p) => p.genre === dominantGenre.genre,
  );
  const hours = Math.round(dominantGenre.watchTimeSeconds / 3600);

  return (
    <section className="relative py-28 px-4 md:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-tl from-blue-950/30 via-transparent to-transparent" />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <motion.span
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 0.04, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-[8rem] md:text-[14rem] lg:text-[18rem] font-black text-white uppercase whitespace-nowrap tracking-tighter"
        >
          {dominantGenre.genre}
        </motion.span>
      </div>

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-7 h-7 text-blue-400" strokeWidth={1.5} />
            <p className="text-base text-white/50 uppercase tracking-wider">
              Dominant genre
            </p>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            You're a{" "}
            <span className="text-blue-400">{dominantGenre.genre}</span> fan
          </h2>
          {topPercentile && topPercentile.percentile >= 50 && (
            <p className="text-lg text-white/60">
              Top{" "}
              <span className="text-blue-400 font-semibold">
                {100 - topPercentile.percentile}%
              </span>{" "}
              of {dominantGenre.genre.toLowerCase()} watchers
            </p>
          )}
        </motion.div>

        <SectionDescription delay={0.2}>
          <Highlight>{hours} hours</Highlight> of{" "}
          {dominantGenre.genre.toLowerCase()} content powered your screens.{" "}
          <span className="text-white/50 italic">
            This genre defined your year.
          </span>
        </SectionDescription>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap gap-8 md:gap-16"
        >
          <div>
            <p className="text-3xl md:text-4xl font-bold">{hours}</p>
            <p className="text-sm text-white/50 uppercase tracking-wider">
              Hours
            </p>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-bold">
              {dominantGenre.playCount}
            </p>
            <p className="text-sm text-white/50 uppercase tracking-wider">
              Plays
            </p>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-bold">
              {dominantGenre.percentageOfTotal}%
            </p>
            <p className="text-sm text-white/50 uppercase tracking-wider">
              Of Watch Time
            </p>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-bold">
              {totalGenresExplored}
            </p>
            <p className="text-sm text-white/50 uppercase tracking-wider">
              Total Genres
            </p>
          </div>
        </motion.div>

        {topGenres.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-16"
          >
            <SubsectionHeader>Other top genres</SubsectionHeader>
            <div className="space-y-3">
              {topGenres.slice(1, 6).map((genre, index) => {
                const percentage =
                  dominantGenre.watchTimeSeconds > 0
                    ? (genre.watchTimeSeconds /
                        dominantGenre.watchTimeSeconds) *
                      100
                    : 0;
                return (
                  <div key={genre.genre} className="flex items-center gap-4">
                    <span className="w-8 text-sm text-white/40">
                      {index + 2}.
                    </span>
                    <span className="w-32 md:w-48 text-sm font-medium truncate">
                      {genre.genre}
                    </span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden max-w-md">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${percentage}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.6 + index * 0.1 }}
                        className="h-full bg-blue-500/60 rounded-full"
                      />
                    </div>
                    <span className="text-sm text-white/40 w-20 text-right">
                      {formatDuration(genre.watchTimeSeconds)}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
