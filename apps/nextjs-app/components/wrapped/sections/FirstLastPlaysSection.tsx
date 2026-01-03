"use client";

import { Calendar, Play } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import type { ServerPublic } from "@/lib/types";
import { getJellyfinImageUrl } from "@/lib/utils";
import {
  AccentHighlight,
  SectionDescription,
  SectionHeader,
  Tagline,
} from "./shared";

interface WatchData {
  itemId: string;
  itemName: string;
  itemType: string;
  timestamp: string;
  primaryImageTag: string | null;
  seriesName: string | null;
  productionYear: number | null;
}

interface FirstLastPlaysSectionProps {
  year: number;
  firstWatch: WatchData | null;
  lastWatch: WatchData | null;
  firstGenre?: string;
  lastGenre?: string;
  server: ServerPublic;
  serverId: number;
}

function formatDate(timestamp: string): string {
  return new Date(timestamp)
    .toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    .toUpperCase();
}

interface PlayCardProps {
  watch: WatchData;
  label: string;
  imageUrl: string | null;
  serverId: number;
  delay: number;
}

function PlayCard({ watch, label, imageUrl, serverId, delay }: PlayCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay }}
      className="group"
    >
      <div className="flex items-center gap-2 text-xs text-white/50 mb-4">
        <Calendar className="w-4 h-4" />
        <span>{label}</span>
      </div>
      <Link
        href={`/servers/${serverId}/library/${watch.itemId}`}
        className="flex gap-5"
      >
        <div className="relative w-28 md:w-36 aspect-[2/3] rounded-xl overflow-hidden bg-white/5 shrink-0 shadow-xl shadow-black/40 group-hover:shadow-black/50 transition-shadow">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={watch.itemName}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 112px, 144px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30">
              No Image
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <h3 className="text-xl md:text-2xl font-bold group-hover:text-blue-300 transition-colors line-clamp-2">
            {watch.itemName}
          </h3>
          {watch.seriesName && (
            <p className="text-white/60 mt-1">{watch.seriesName}</p>
          )}
          <p className="text-sm text-white/40 mt-3 font-mono">
            {formatDate(watch.timestamp)}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

export function FirstLastPlaysSection({
  year,
  firstWatch,
  lastWatch,
  firstGenre,
  lastGenre,
  server,
  serverId,
}: FirstLastPlaysSectionProps) {
  if (!firstWatch && !lastWatch) return null;

  const firstImageUrl = firstWatch
    ? getJellyfinImageUrl(
        server.url,
        firstWatch.itemId,
        firstWatch.primaryImageTag,
      )
    : null;
  const lastImageUrl = lastWatch
    ? getJellyfinImageUrl(
        server.url,
        lastWatch.itemId,
        lastWatch.primaryImageTag,
      )
    : null;

  return (
    <section className="relative py-28 px-4 md:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-950/30 via-transparent to-transparent" />

      <div className="max-w-6xl mx-auto relative">
        <SectionHeader
          icon={Play}
          label="The full circle"
          title="First & Last Plays"
        />

        <SectionDescription>
          {firstGenre && lastGenre ? (
            <>
              Kicked off {year} in{" "}
              <AccentHighlight>{firstGenre}</AccentHighlight> mode
              {firstGenre === lastGenre ? (
                <>
                  {" "}
                  and wrapped it up the same way.{" "}
                  <Tagline>You know what you like.</Tagline>
                </>
              ) : (
                <>
                  , wrapped it up as a true{" "}
                  <AccentHighlight>{lastGenre}</AccentHighlight> aficionado.
                </>
              )}
            </>
          ) : (
            <>
              From the opening scene to the final credits, here's how you
              bookended {year}.
            </>
          )}
        </SectionDescription>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
          {firstWatch && (
            <PlayCard
              watch={firstWatch}
              label="FIRST PLAY"
              imageUrl={firstImageUrl}
              serverId={serverId}
              delay={0.2}
            />
          )}
          {lastWatch && (
            <PlayCard
              watch={lastWatch}
              label="LAST PLAY"
              imageUrl={lastImageUrl}
              serverId={serverId}
              delay={0.3}
            />
          )}
        </div>
      </div>
    </section>
  );
}
