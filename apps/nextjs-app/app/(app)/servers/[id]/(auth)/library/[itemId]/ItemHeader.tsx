"use client";

import type { Item } from "@streamystats/database/schema";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Star,
  Trash2,
  Tv,
} from "lucide-react";
import Link from "next/link";
import { Poster } from "@/app/(app)/servers/[id]/(auth)/dashboard/Poster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ServerPublic } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { AddToWatchlistButton } from "./AddToWatchlistButton";
import { MarkAsWatchedButton } from "./MarkAsWatchedButton";
import type { ItemDetailsResponse } from "./types";

interface ItemHeaderProps {
  item: Item;
  server: ServerPublic;
  statistics: ItemDetailsResponse;
  serverId: number;
  userId: string;
  isPlayed: boolean;
}

function formatRuntime(runtimeTicks: number): string {
  // Convert ticks to milliseconds (1 tick = 100 nanoseconds)
  const milliseconds = runtimeTicks / 10000;
  return formatDuration(Math.round(milliseconds / 1000));
}

function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function ItemHeader({
  item,
  server,
  statistics,
  serverId,
  userId,
  isPlayed,
}: ItemHeaderProps) {
  const isDeleted = item.deletedAt !== null;

  return (
    <Card className={isDeleted ? "border-destructive/50" : undefined}>
      <CardContent className="p-6 relative">
        {isDeleted && (
          <div className="absolute top-0 left-0 right-0 bg-destructive/10 border-b border-destructive/30 px-4 py-2 flex items-center gap-2 rounded-t-lg">
            <Trash2 className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              This item has been removed from Jellyfin
            </span>
          </div>
        )}

        <div
          className={`absolute ${isDeleted ? "top-14" : "top-4"} right-4 z-10 flex gap-2`}
        >
          {!isDeleted && (
            <>
              <MarkAsWatchedButton
                itemId={item.id}
                serverId={serverId}
                userId={userId}
                initialIsPlayed={isPlayed}
              />
              <AddToWatchlistButton
                itemId={item.id}
                itemType={item.type}
                serverId={serverId}
              />
            </>
          )}
          <Button
            asChild
            variant="outline"
            className="gap-2"
            disabled={isDeleted}
          >
            <a
              href={`${server.url}/web/index.html#!/details?id=${item.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={
                isDeleted ? "pointer-events-none opacity-50" : undefined
              }
            >
              <ExternalLink className="w-4 h-4" />
              Open in Jellyfin
            </a>
          </Button>
        </div>

        <div
          className={`flex flex-col lg:flex-row gap-6 ${
            isDeleted ? "pt-10" : ""
          }`}
        >
          <div className="flex-shrink-0 mx-auto lg:mx-0">
            <div className={`w-48 ${isDeleted ? "opacity-60 grayscale" : ""}`}>
              <Poster
                item={item}
                server={server}
                width={400}
                height={600}
                preferredImageType="Primary"
                className="shadow-lg w-full"
              />
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
                  {item.name}
                </h1>
                {isDeleted && (
                  <Badge variant="destructive" className="text-xs">
                    <Trash2 className="w-3 h-3 mr-1" />
                    Removed
                  </Badge>
                )}
              </div>
              {item.type === "Episode" && (
                <div className="space-y-2">
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    {item.seasonName && <span>{item.seasonName}</span>}
                    {item.indexNumber && (
                      <span>Episode {item.indexNumber}</span>
                    )}
                  </div>
                  {item.seriesId && item.seriesName && (
                    <Link
                      href={`/servers/${serverId}/library/${item.seriesId}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted hover:bg-accent border border-border hover:border-primary/50 transition-colors group"
                    >
                      <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <Tv className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                        {item.seriesName}
                      </span>
                    </Link>
                  )}
                </div>
              )}
              {item.originalTitle && item.originalTitle !== item.name && (
                <p className="text-lg text-muted-foreground mb-2">
                  {item.originalTitle}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {item.productionYear && (
                  <Badge variant="outline" className="text-sm">
                    <Calendar className="w-4 h-4 mr-1" />
                    {item.productionYear}
                  </Badge>
                )}
                {item.officialRating && (
                  <Badge variant="outline" className="text-sm">
                    {item.officialRating}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {item.communityRating && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">
                    {formatRating(item.communityRating)}
                  </span>
                  <span className="text-sm text-muted-foreground">/10</span>
                </div>
              )}

              {(item.type === "Movie" || item.type === "Episode") &&
                item.runtimeTicks && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{formatRuntime(item.runtimeTicks)}</span>
                  </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>{item.type}</span>
              <span>
                {statistics.totalViews} view
                {statistics.totalViews === 1 ? "" : "s"}
              </span>
              <span>{formatDuration(statistics.totalWatchTime)} watched</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
