"use client";

import { Clock, Film, Tv } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ItemWithStats } from "@/lib/db/wrapped";
import type { ServerPublic } from "@/lib/types";
import { formatDuration, getJellyfinImageUrl } from "@/lib/utils";
import { Highlight, SectionDescription, Tagline } from "./shared";

interface MostPlayedSectionProps {
  movies: ItemWithStats[];
  series: ItemWithStats[];
  server: ServerPublic;
  serverId: number;
}

type ContentType = "series" | "movies";

interface ContentToggleProps {
  activeType: ContentType;
  onTypeChange: (type: ContentType) => void;
  hasMovies: boolean;
  hasSeries: boolean;
}

function ContentToggle({
  activeType,
  onTypeChange,
  hasMovies,
  hasSeries,
}: ContentToggleProps) {
  const showBoth = hasMovies && hasSeries;

  if (!showBoth) return null;

  return (
    <div className="relative p-1 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 w-fit">
      <div className="relative flex">
        <button
          type="button"
          onClick={() => onTypeChange("series")}
          className="relative z-10 flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors"
        >
          {activeType === "series" && (
            <motion.div
              layoutId="content-toggle-indicator"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30"
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
            />
          )}
          <Tv
            className={`relative z-10 w-4 h-4 transition-all duration-300 ${
              activeType === "series"
                ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                : "text-white/50"
            }`}
          />
          <span
            className={`relative z-10 transition-colors duration-300 ${
              activeType === "series" ? "text-white" : "text-white/50"
            }`}
          >
            Shows
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTypeChange("movies")}
          className="relative z-10 flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors"
        >
          {activeType === "movies" && (
            <motion.div
              layoutId="content-toggle-indicator"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30"
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
            />
          )}
          <Film
            className={`relative z-10 w-4 h-4 transition-all duration-300 ${
              activeType === "movies"
                ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                : "text-white/50"
            }`}
          />
          <span
            className={`relative z-10 transition-colors duration-300 ${
              activeType === "movies" ? "text-white" : "text-white/50"
            }`}
          >
            Movies
          </span>
        </button>
      </div>
    </div>
  );
}

interface PosterCardProps {
  item: ItemWithStats;
  rank: number;
  server: ServerPublic;
  serverId: number;
  index: number;
}

function PosterCard({ item, rank, server, serverId, index }: PosterCardProps) {
  const imageUrl = getJellyfinImageUrl(
    server.url,
    item.id,
    item.primaryImageTag,
    {
      width: 600,
      height: 900,
    },
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="flex flex-col"
    >
      <Link
        href={`/servers/${serverId}/library/${item.id}`}
        className="group block"
      >
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 shadow-xl shadow-black/30 group-hover:shadow-black/50 transition-all duration-300 group-hover:scale-[1.02]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30">
              No Image
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80" />
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3">
            <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              .{rank.toString().padStart(2, "0")}
            </span>
          </div>
        </div>
      </Link>
      <div className="mt-3 px-1">
        <p className="text-xs text-white/50 font-mono uppercase tracking-wider">
          {formatDuration(item.totalPlayDuration)} · {item.totalPlayCount} plays
        </p>
      </div>
    </motion.div>
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
    { width: 600, height: 900 },
  );
  const topBackdropTag = topItem.backdropImageTags?.[0] ?? null;
  const topBackdropUrl = topBackdropTag
    ? `${server.url}/Items/${topItem.id}/Images/Backdrop?fillHeight=720&fillWidth=1280&quality=90&tag=${topBackdropTag}`
    : null;

  return (
    <section className="relative py-28 px-4 md:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-blue-950/20 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-bl from-blue-950/30 via-transparent to-transparent" />

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12"
        >
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-7 h-7 text-blue-400" strokeWidth={1.5} />
              <p className="text-base text-white/50 uppercase tracking-wider">
                Top content
              </p>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Most Plays of the Year.
            </h2>
          </div>

          <ContentToggle
            activeType={activeType}
            onTypeChange={setActiveType}
            hasMovies={movies.length > 0}
            hasSeries={series.length > 0}
          />
        </motion.div>

        <SectionDescription>
          {activeType === "series" ? (
            <>
              While nothing came close to <Highlight>{topItem.name}</Highlight>{" "}
              this year, here are the{" "}
              <Tagline>
                top {Math.min(items.length, 10)} shows which took some time to
                get through.
              </Tagline>
            </>
          ) : (
            <>
              While nothing came close to <Highlight>{topItem.name}</Highlight>{" "}
              this year, here are the{" "}
              <Tagline>
                top {Math.min(items.length, 10)} films which took some time to
                get through.
              </Tagline>
            </>
          )}
        </SectionDescription>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <Link
            href={`/servers/${serverId}/library/${topItem.id}`}
            className="group grid grid-cols-[auto_1fr] gap-4 md:gap-6 items-end"
          >
            <div className="relative w-32 sm:w-40 md:w-48 aspect-[2/3] rounded-xl overflow-hidden bg-white/5 shadow-2xl shadow-black/50 group-hover:shadow-black-500/20 transition-all duration-500 group-hover:scale-[1.02] z-10">
              {topImageUrl ? (
                <Image
                  src={topImageUrl}
                  alt={topItem.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 128px, (max-width: 768px) 160px, 192px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30">
                  No Image
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80" />
              <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3">
                <span className="text-4xl sm:text-5xl md:text-6xl font-black drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
                  .01
                </span>
              </div>
            </div>

            <div className="relative flex flex-col justify-end h-full">
              {topBackdropUrl && (
                <div className="absolute inset-0 rounded-xl overflow-hidden">
                  <Image
                    src={topBackdropUrl}
                    alt={`${topItem.name} backdrop`}
                    fill
                    className="object-cover object-top opacity-60 group-hover:opacity-80 transition-opacity duration-500"
                    sizes="(max-width: 768px) 60vw, 500px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                </div>
              )}
              <div className="relative p-4 md:p-6">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold group-hover:text-blue-300 transition-colors mb-1 md:mb-2">
                  {topItem.name}
                </h3>
                <p className="text-white/60 text-xs sm:text-sm font-mono uppercase tracking-wider">
                  {formatDuration(topItem.totalPlayDuration)} &bull;{" "}
                  {topItem.totalPlayCount} plays
                </p>
              </div>
            </div>
          </Link>
        </motion.div>

        {restItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-8 lg:gap-14 px-4 sm:px-8 lg:px-28 py-6">
            {restItems.map((item, index) => (
              <PosterCard
                key={item.id}
                item={item}
                rank={index + 2}
                server={server}
                serverId={serverId}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
