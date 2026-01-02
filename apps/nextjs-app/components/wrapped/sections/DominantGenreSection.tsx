"use client";

import { TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import type { GenrePercentile, GenreStats } from "@/lib/db/wrapped";
import { formatDuration } from "@/lib/utils";

interface DominantGenreSectionProps {
  year: number;
  topGenres: GenreStats[];
  genrePercentiles: GenrePercentile[];
  totalGenresExplored: number;
}

export function DominantGenreSection({
  year,
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
    <section className="relative py-32 px-4 md:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-tl from-blue-950/30 via-transparent to-transparent" />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <motion.span
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 0.05, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-[8rem] md:text-[14rem] lg:text-[18rem] font-black text-white uppercase whitespace-nowrap tracking-tighter"
        >
          {dominantGenre.genre}
        </motion.span>
      </div>

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3 mb-12"
        >
          <TrendingUp className="w-8 h-8 text-blue-400" strokeWidth={1.5} />
          <span className="text-xl text-white/60">
            Your dominant genre in {year} was
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-black mb-8"
        >
          <span className="text-blue-400">{dominantGenre.genre}</span>
          <span className="text-white">.</span>
        </motion.h2>

        {topPercentile && topPercentile.percentile >= 50 && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl md:text-2xl text-white/80 mb-6"
          >
            In fact you placed in the{" "}
            <span className="text-blue-400 font-bold">
              top {100 - topPercentile.percentile}%
            </span>{" "}
            of {dominantGenre.genre} connoisseurs.
          </motion.p>
        )}

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg md:text-xl text-white/60 mb-12 max-w-2xl"
        >
          With <span className="font-bold text-white">{hours}</span> hours of{" "}
          {dominantGenre.genre.toLowerCase()} content, this genre powered your
          screens this year.
        </motion.p>

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
            <h3 className="text-lg text-white/60 mb-6">Other top genres:</h3>
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
