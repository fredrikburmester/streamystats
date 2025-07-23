"use client";

import { Poster } from "@/app/(app)/servers/[id]/(auth)/dashboard/Poster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import { Item, Server } from "@streamystats/database/schema";
import {
  Star,
  Clock,
  Calendar,
  Eye,
  PlayCircle,
  ExternalLink,
  Folder,
  Tag,
  CheckCircle,
} from "lucide-react";

interface ItemDetailsResponse {
  item: Item;
  totalViews: number;
  totalWatchTime: number;
  completionRate: number;
  firstWatched: Date | null;
  lastWatched: Date | null;
}

interface ItemHeaderProps {
  item: Item;
  server: Server;
  statistics: ItemDetailsResponse;
}

function formatRuntime(runtimeTicks: number): string {
  // Convert ticks to milliseconds (1 tick = 100 nanoseconds)
  const milliseconds = runtimeTicks / 10000;
  return formatDuration(Math.round(milliseconds / 1000));
}

function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function ItemHeader({ item, server, statistics }: ItemHeaderProps) {
  return (
    <Card>
      <CardContent className="p-6 relative">
        {/* Open in Jellyfin Button - Top Right */}
        <div className="absolute top-4 right-4 z-10">
          <Button asChild variant="outline" className="gap-2">
            <a
              href={`${server.url}/web/index.html#!/details?id=${item.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Jellyfin
            </a>
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-shrink-0 mx-auto lg:mx-0">
            <div className="w-48">
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
              <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
                {item.name}
              </h1>
              {item.type === "Episode" && (
                <div className="space-y-1">
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    {item.seasonName && <span>{item.seasonName}</span>}
                    {item.indexNumber && (
                      <span>Episode {item.indexNumber}</span>
                    )}
                  </div>
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

            {item.overview && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Overview</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {item.overview}
                </p>
              </div>
            )}

            {item.genres && item.genres.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Genres
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.genres.map((genre) => (
                    <Badge key={genre} variant="secondary">
                      {genre}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {item.path && (
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Folder className="w-4 h-4" />
                  File Path
                </h3>
                <p className="text-sm font-mono bg-muted px-3 py-2 rounded break-all text-muted-foreground">
                  {item.path}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
