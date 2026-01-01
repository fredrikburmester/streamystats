"use client";

import Image from "next/image";
import Link from "next/link";
import type { ServerPublic } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

interface RankedItem {
  id: string;
  name: string;
  subtitle?: string;
  imageTag?: string | null;
  seriesId?: string | null;
  seriesPrimaryImageTag?: string | null;
  watchTimeSeconds: number;
  playCount: number;
}

interface WrappedRankedListProps {
  items: RankedItem[];
  server: ServerPublic;
  serverId: number;
  type: "movie" | "series" | "actor" | "director";
  maxItems?: number;
}

function getImageUrl(
  item: RankedItem,
  server: ServerPublic,
  type: "movie" | "series" | "actor" | "director"
): string | null {
  if (type === "actor" || type === "director") {
    if (item.imageTag) {
      return `${server.url}/Items/${item.id}/Images/Primary?fillHeight=120&fillWidth=80&quality=90&tag=${item.imageTag}`;
    }
    return null;
  }

  // For series, use series image
  if (type === "series" && item.imageTag) {
    return `${server.url}/Items/${item.id}/Images/Primary?fillHeight=150&fillWidth=100&quality=90&tag=${item.imageTag}`;
  }

  // For movies
  if (item.imageTag) {
    return `${server.url}/Items/${item.id}/Images/Primary?fillHeight=150&fillWidth=100&quality=90&tag=${item.imageTag}`;
  }

  // Fallback to series image for episodes
  if (item.seriesId && item.seriesPrimaryImageTag) {
    return `${server.url}/Items/${item.seriesId}/Images/Primary?fillHeight=150&fillWidth=100&quality=90&tag=${item.seriesPrimaryImageTag}`;
  }

  return null;
}

function getItemLink(
  item: RankedItem,
  serverId: number,
  type: "movie" | "series" | "actor" | "director"
): string {
  if (type === "actor" || type === "director") {
    return `/servers/${serverId}/actors/${item.id}`;
  }
  return `/servers/${serverId}/library/${item.id}`;
}

export function WrappedRankedList({
  items,
  server,
  serverId,
  type,
  maxItems = 10,
}: WrappedRankedListProps) {
  const displayItems = items.slice(0, maxItems);

  return (
    <div className="space-y-3">
      {displayItems.map((item, index) => {
        const imageUrl = getImageUrl(item, server, type);
        const link = getItemLink(item, serverId, type);
        const rank = index + 1;

        return (
          <Link
            key={item.id}
            href={link}
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg",
              "bg-white/5 hover:bg-white/10 transition-colors",
              "group"
            )}
          >
            {/* Rank badge */}
            <div
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                rank === 1 && "bg-amber-500 text-amber-950",
                rank === 2 && "bg-zinc-300 text-zinc-800",
                rank === 3 && "bg-amber-700 text-amber-100",
                rank > 3 && "bg-white/20 text-white"
              )}
            >
              {rank}
            </div>

            {/* Poster */}
            <div className="flex-shrink-0 w-12 h-16 md:w-14 md:h-20 relative rounded overflow-hidden bg-white/10">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={item.name}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">
                  N/A
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm md:text-base truncate group-hover:text-white/90">
                {item.name}
              </div>
              {item.subtitle && (
                <div className="text-xs text-white/60 truncate">
                  {item.subtitle}
                </div>
              )}
              <div className="text-xs text-white/60 mt-0.5">
                {formatDuration(item.watchTimeSeconds)} &middot; {item.playCount}{" "}
                {item.playCount === 1 ? "play" : "plays"}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
