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
  type: "movie" | "series" | "actor" | "director",
): string | null {
  if (type === "actor" || type === "director") {
    if (item.imageTag) {
      return `${server.url}/Items/${item.id}/Images/Primary?fillHeight=120&fillWidth=80&quality=90&tag=${item.imageTag}`;
    }
    return null;
  }

  if (type === "series" && item.imageTag) {
    return `${server.url}/Items/${item.id}/Images/Primary?fillHeight=150&fillWidth=100&quality=90&tag=${item.imageTag}`;
  }

  if (item.imageTag) {
    return `${server.url}/Items/${item.id}/Images/Primary?fillHeight=150&fillWidth=100&quality=90&tag=${item.imageTag}`;
  }

  if (item.seriesId && item.seriesPrimaryImageTag) {
    return `${server.url}/Items/${item.seriesId}/Images/Primary?fillHeight=150&fillWidth=100&quality=90&tag=${item.seriesPrimaryImageTag}`;
  }

  return null;
}

function getItemLink(
  item: RankedItem,
  serverId: number,
  type: "movie" | "series" | "actor" | "director",
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
  maxItems = 5,
}: WrappedRankedListProps) {
  const displayItems = items.slice(0, maxItems);
  const maxWatchTime = Math.max(...displayItems.map((i) => i.watchTimeSeconds));

  if (displayItems.length === 0) return null;

  const topItem = displayItems[0];
  const restItems = displayItems.slice(1);
  const topImageUrl = getImageUrl(topItem, server, type);
  const topLink = getItemLink(topItem, serverId, type);

  return (
    <div className="space-y-4">
      {/* #1 Item - Featured */}
      <Link
        href={topLink}
        className="flex gap-4 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
      >
        <div className="relative w-16 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
          {topImageUrl ? (
            <Image
              src={topImageUrl}
              alt={topItem.name}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              N/A
            </div>
          )}
          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
            <span className="text-[10px] font-bold text-amber-950">1</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 py-1">
          <h4 className="font-semibold text-sm truncate group-hover:underline">
            {topItem.name}
          </h4>
          {topItem.subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {topItem.subtitle}
            </p>
          )}
          <p className="text-lg font-bold mt-2">
            {formatDuration(topItem.watchTimeSeconds)}
          </p>
          <p className="text-xs text-muted-foreground">
            {topItem.playCount} {topItem.playCount === 1 ? "play" : "plays"}
          </p>
        </div>
      </Link>

      {/* Rest of items */}
      {restItems.length > 0 && (
        <div className="space-y-1">
          {restItems.map((item, index) => {
            const imageUrl = getImageUrl(item, server, type);
            const link = getItemLink(item, serverId, type);
            const rank = index + 2;
            const barWidth = (item.watchTimeSeconds / maxWatchTime) * 100;

            return (
              <Link
                key={item.id}
                href={link}
                className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <span
                  className={cn(
                    "w-5 text-xs font-medium text-center shrink-0",
                    rank === 2 && "text-zinc-400",
                    rank === 3 && "text-amber-700",
                    rank > 3 && "text-muted-foreground",
                  )}
                >
                  {rank}
                </span>

                <div className="w-8 h-12 relative rounded overflow-hidden bg-muted shrink-0">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[8px]">
                      N/A
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm truncate group-hover:underline">
                      {item.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDuration(item.watchTimeSeconds)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-foreground/20 rounded-full"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
