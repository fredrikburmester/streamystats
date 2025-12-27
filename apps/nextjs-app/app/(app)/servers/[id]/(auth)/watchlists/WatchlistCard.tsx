"use client";

import type { Item } from "@streamystats/database";
import { ChevronRight, Film, Globe, Lock, Tv } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { WatchlistWithItemCount } from "@/lib/db/watchlists";

interface WatchlistCardProps {
  watchlist: WatchlistWithItemCount;
  previewItems: Item[];
  serverId: number;
  serverUrl: string;
  isOwner: boolean;
}

function getItemImageUrl(item: Item, serverUrl: string): string | null {
  if (item.primaryImageTag) {
    return `${serverUrl}/Items/${item.id}/Images/Primary?fillHeight=200&fillWidth=150&quality=85&tag=${item.primaryImageTag}`;
  }
  if (item.seriesId && item.seriesPrimaryImageTag) {
    return `${serverUrl}/Items/${item.seriesId}/Images/Primary?fillHeight=200&fillWidth=150&quality=85&tag=${item.seriesPrimaryImageTag}`;
  }
  return null;
}

function WatchlistPoster({
  items,
  serverUrl,
}: {
  items: Item[];
  serverUrl: string;
}) {
  if (items.length === 0) {
    return (
      <div className="aspect-[2/3] bg-gradient-to-br from-muted/50 to-muted rounded-lg flex items-center justify-center border border-border/50">
        <div className="text-center">
          <Film className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground/60 font-medium">Empty</p>
        </div>
      </div>
    );
  }

  const gridItems = items.slice(0, 4);
  const placeholders = 4 - gridItems.length;

  return (
    <div className="aspect-[2/3] rounded-lg overflow-hidden relative group/poster">
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
        {gridItems.map((item) => {
          const imageUrl = getItemImageUrl(item, serverUrl);
          return (
            <div key={item.id} className="relative bg-muted overflow-hidden">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={item.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 150px"
                  className="object-cover transition-transform duration-300 group-hover/poster:scale-105"
                  loading="lazy"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/80">
                  {item.type === "Movie" ? (
                    <Film className="w-5 h-5 text-muted-foreground/50" />
                  ) : (
                    <Tv className="w-5 h-5 text-muted-foreground/50" />
                  )}
                </div>
              )}
            </div>
          );
        })}
        {Array.from({ length: placeholders }).map((_, idx) => (
          <div
            key={`placeholder-${idx}`}
            className="bg-gradient-to-br from-muted/60 to-muted/40 flex items-center justify-center"
          >
            <div className="w-3 h-3 rounded-full bg-muted-foreground/10" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/poster:opacity-100 transition-opacity duration-300" />
    </div>
  );
}

export function WatchlistCard({
  watchlist,
  previewItems,
  serverId,
  serverUrl,
  isOwner,
}: WatchlistCardProps) {
  const params = useParams();
  const serverIdParam = params.id as string;

  return (
    <Link href={`/servers/${serverIdParam}/watchlists/${watchlist.id}`}>
      <Card className="group h-full flex flex-col hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="relative p-4 pb-3">
            <WatchlistPoster items={previewItems} serverUrl={serverUrl} />
          </div>

          <div className="px-4 pb-4 pt-2 flex-1 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2 min-h-[3rem]">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors duration-200 line-clamp-2">
                  {watchlist.name}
                </h3>
                {watchlist.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
                    {watchlist.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                {watchlist.isPublic ? (
                  <Globe className="w-4 h-4 text-muted-foreground/70" />
                ) : (
                  <Lock className="w-4 h-4 text-muted-foreground/70" />
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-auto">
              <Badge
                variant="secondary"
                className="text-xs font-medium px-2.5 py-0.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15"
              >
                {watchlist.itemCount}{" "}
                {watchlist.itemCount === 1 ? "item" : "items"}
              </Badge>
              {watchlist.allowedItemType && (
                <Badge
                  variant="outline"
                  className="text-xs font-medium px-2.5 py-0.5 border-border/50"
                >
                  {watchlist.allowedItemType}
                </Badge>
              )}
              {!isOwner && (
                <Badge
                  variant="outline"
                  className="text-xs font-medium px-2.5 py-0.5 text-muted-foreground border-border/50"
                >
                  Shared
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
