"use client";

import { Clock, Film, Tv } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ItemWithStats } from "@/lib/db/wrapped";
import type { ServerPublic } from "@/lib/types";
import { formatDuration, getJellyfinImageUrl } from "@/lib/utils";

interface MostPlayedSectionProps {
  movies: ItemWithStats[];
  series: ItemWithStats[];
  server: ServerPublic;
  serverId: number;
}

type ContentType = "series" | "movies";

interface ItemGridCardProps {
  item: ItemWithStats;
  rank: number;
  server: ServerPublic;
  serverId: number;
}

function ItemGridCard({ item, rank, server, serverId }: ItemGridCardProps) {
  const imageUrl = getJellyfinImageUrl(
    server.url,
    item.id,
    item.primaryImageTag,
  );

  return (
    <Link href={`/servers/${serverId}/library/${item.id}`} className="group">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 shadow-xl shadow-black/40 group-hover:shadow-black/50 transition-shadow">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100px, 150px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
            No Image
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute bottom-2 right-2">
          <span className="text-2xl md:text-3xl font-black text-white">
            .{rank.toString().padStart(2, "0")}
          </span>
        </div>
      </div>
      <p className="text-xs text-white/50 mt-2 font-mono uppercase tracking-wider truncate">
        {formatDuration(item.totalPlayDuration)} &bull; {item.totalPlayCount}{" "}
        plays
      </p>
    </Link>
  );
}

export function MostPlayedSection({
  movies,
  series,
  server,
  serverId,
}: MostPlayedSectionProps) {
  const [activeType, setActiveType] = useState<ContentType>(
    series.length > 0 ? "series" : "movies",
  );

  const items = activeType === "series" ? series : movies;
  if (items.length === 0) return null;

  const topItem = items[0];
  const restItems = items.slice(1, 10);
  const topImageUrl = getJellyfinImageUrl(
    server.url,
    topItem.id,
    topItem.primaryImageTag,
    { width: 400, height: 600 },
  );

  return (
    <section className="relative py-24 px-4 md:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-bl from-blue-950/30 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-blue-950/15 to-transparent" />

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-400" strokeWidth={1.5} />
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              Most Plays of the Year.
            </h2>
          </div>

          <div className="flex gap-2">
            {series.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveType("series")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeType === "series"
                    ? "bg-blue-500 text-white"
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                <Tv className="w-4 h-4" />
                Shows
              </button>
            )}
            {movies.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveType("movies")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeType === "movies"
                    ? "bg-blue-500 text-white"
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                <Film className="w-4 h-4" />
                Movies
              </button>
            )}
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-lg text-white/60 mb-12"
        >
          {activeType === "series" ? (
            <>
              While nothing came close to{" "}
              <strong className="text-white">{topItem.name}</strong> this year,
              here are the{" "}
              <span className="text-blue-400 font-semibold">
                top {Math.min(items.length, 10)} shows
              </span>{" "}
              which took some time to get through.
            </>
          ) : (
            <>
              <strong className="text-white">{topItem.name}</strong> led your
              movie nights this year. Here are your{" "}
              <span className="text-blue-400 font-semibold">
                top {Math.min(items.length, 10)} movies
              </span>
              .
            </>
          )}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <Link
            href={`/servers/${serverId}/library/${topItem.id}`}
            className="group flex flex-col md:flex-row gap-6 md:items-end"
          >
            <div className="relative w-40 md:w-56 aspect-[2/3] rounded-2xl overflow-hidden bg-white/5 shadow-2xl shadow-black/40 group-hover:shadow-black/50 transition-all">
              {topImageUrl ? (
                <Image
                  src={topImageUrl}
                  alt={topItem.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 160px, 224px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30">
                  No Image
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="absolute bottom-3 right-3">
                <span className="text-4xl md:text-5xl font-black text-white">
                  .01
                </span>
              </div>
            </div>
            <div className="pb-2">
              <h3 className="text-2xl md:text-3xl font-bold group-hover:text-blue-300 transition-colors mb-2">
                {topItem.name}
              </h3>
              <p className="text-white/50 text-sm font-mono uppercase tracking-wider">
                {formatDuration(topItem.totalPlayDuration)} &bull;{" "}
                {topItem.totalPlayCount} plays
              </p>
            </div>
          </Link>
        </motion.div>

        {restItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4"
          >
            {restItems.map((item, index) => (
              <ItemGridCard
                key={item.id}
                item={item}
                rank={index + 2}
                server={server}
                serverId={serverId}
              />
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
