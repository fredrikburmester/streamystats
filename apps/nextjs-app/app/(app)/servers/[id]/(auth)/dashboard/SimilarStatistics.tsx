"use client";

import { Poster } from "@/app/(app)/servers/[id]/(auth)/dashboard/Poster";
import { JellyseerrPoster } from "@/app/(app)/servers/[id]/(auth)/dashboard/JellyseerrPoster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  hideRecommendation,
  RecommendationItem,
  UnifiedRecommendationItem,
} from "@/lib/db/similar-statistics";
import { Server } from "@streamystats/database";
import { EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  data: RecommendationItem[];
  server: Server;
}

// Helper component to render the appropriate poster based on item source
const ItemPoster = ({
  item,
  server,
}: {
  item: UnifiedRecommendationItem;
  server: Server;
}) => {
  if (item.source === "jellyseerr") {
    return (
      <JellyseerrPoster
        movie={{
          id: item.id,
          title: item.name,
          originalTitle: item.name,
          overview: item.overview,
          releaseDate: null,
          productionYear: item.productionYear,
          type: item.type,
          communityRating: item.communityRating,
          popularity: null,
          posterPath: item.posterPath ?? null,
          backdropPath: item.backdropPath ?? null,
          genres: item.genres ?? null,
          sourceType: item.sourceType || "popular",
          mediaType: item.mediaType || "movie",
        }}
        width={240}
        height={360}
        className="w-full h-48 sm:h-56 rounded-b-none"
      />
    );
  } else {
    return (
      <Poster
        item={item as any}
        server={server}
        width={240}
        height={360}
        preferredImageType="Primary"
        className="w-full h-48 sm:h-56 rounded-b-none"
      />
    );
  }
};

// Helper component to render the appropriate link based on item source
const ItemLink = ({
  item,
  server,
  children,
}: {
  item: UnifiedRecommendationItem;
  server: Server;
  children: React.ReactNode;
}) => {
  if (item.source === "jellyseerr") {
    return (
      <a
        href={`https://www.themoviedb.org/${item.mediaType}/${item.id
          .replace("jellyseerr-movie-", "")
          .replace("jellyseerr-tv-", "")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-[200px] sm:w-[240px] flex-col overflow-hidden border border-border bg-card rounded-lg hover:shadow-lg transition-all "
      >
        {children}
      </a>
    );
  } else {
    return (
      <Link
        href={`/servers/${server.id}/library/${item.id}`}
        className="flex w-[200px] sm:w-[240px] flex-col overflow-hidden border border-border bg-card rounded-lg hover:shadow-lg transition-all "
      >
        {children}
      </Link>
    );
  }
};

export const SimilarStatistics = ({ data, server }: Props) => {
  const [recommendations, setRecommendations] = useState(data);
  const [hidingItems, setHidingItems] = useState<Set<string>>(new Set());

  const handleHideRecommendation = async (
    recommendation: RecommendationItem
  ) => {
    const { item } = recommendation;
    if (!item.id || hidingItems.has(item.id)) {
      console.warn("Item already hidden or missing jellyfin_id", item);
      return;
    }

    const jellyfinId = item.id;
    setHidingItems((prev) => new Set(prev).add(jellyfinId));

    try {
      const result = await hideRecommendation(server.id, jellyfinId);

      if (result.success) {
        // Remove the recommendation from recommendations
        setRecommendations((prev) =>
          prev.filter((rec) => rec.item.id !== jellyfinId)
        );
        toast.success("Recommendation hidden successfully");
      } else {
        toast.error(result.error || "Failed to hide recommendation");
      }
    } catch (error) {
      console.error("Error hiding recommendation:", error);
      toast.error("Failed to hide recommendation");
    } finally {
      setHidingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(jellyfinId);
        return newSet;
      });
    }
  };

  // Group items by type
  const groupedItems = Array.isArray(recommendations)
    ? recommendations.reduce(
        (acc: Record<string, RecommendationItem[]>, recommendation) => {
          const item = recommendation?.item;
          if (!item || !item.type) {
            return acc;
          }

          acc[item.type] = acc[item.type] || [];

          // Only add if we don't have 20 yet
          if (acc[item.type].length < 20) {
            acc[item.type].push(recommendation);
          }

          return acc;
        },
        {}
      )
    : {};

  // Get unique types
  const types = Object.keys(groupedItems);

  // Default to first type if available
  const defaultTab = types.length > 0 ? types[0].toLowerCase() : "all";

  // Format runtime from ticks to hours and minutes
  const formatRuntime = (ticks: number | null) => {
    if (!ticks) {
      return null;
    }
    const minutes = Math.floor(ticks / 600000000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes > 0 ? `${remainingMinutes}m` : ""}`;
    }
    return `${minutes}m`;
  };

  if (
    !recommendations ||
    !Array.isArray(recommendations) ||
    recommendations.length === 0
  ) {
    return (
      <Card>
        <CardHeader className="">
          <CardTitle>Recommended Content</CardTitle>
          <CardDescription>No recommendations available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col max-w-full">
      <CardHeader className="px-4 sm:px-6 mb-0 pb-0">
        <CardTitle className="text-lg sm:text-xl">
          Recommended Movies for You
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Based on the movies you've been watching and popular content from
          Jellyseerr
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 m-0 pt-0 max-w-full overflow-hidden">
        {(!server.openAiApiToken || server.openAiApiToken === "") &&
        server.embeddingProvider === "openai" ? (
          <div className="flex flex-col gap-2 max-w-full pt-4">
            <Link
              href={`/servers/${server.id}/settings/ai`}
              className="w-full sm:w-auto"
            >
              <Button className="w-full sm:w-auto text-sm" size="sm">
                Set up OpenAI API key
              </Button>
            </Link>
            <p className="opacity-70 text-xs">
              To get recommendations, you need to set up an OpenAI API key.
            </p>
          </div>
        ) : (
          <Tabs defaultValue={defaultTab}>
            {types.map((type) => (
              <TabsContent key={type} value={type.toLowerCase()} className="">
                {/* Horizontal scrollable container */}
                <ScrollArea dir="ltr" className="py-4">
                  <div className="flex gap-4 min-w-full w-max">
                    {groupedItems[type].map((recommendation) => {
                      const item = recommendation.item;
                      return (
                        <div
                          key={item.id || `${item.name}-${item.productionYear}`}
                          className="flex-shrink-0 group relative"
                        >
                          <ItemLink item={item} server={server}>
                            {/* Poster */}
                            <div className="relative">
                              <ItemPoster item={item} server={server} />

                              {/* Source badge for Jellyseerr items */}
                              {item.source === "jellyseerr" && (
                                <div className="absolute top-2 right-2">
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0.5 bg-blue-500/80 text-white"
                                  >
                                    Jellyseerr
                                  </Badge>
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex grow flex-col justify-between p-3">
                              <div>
                                <h3 className="text-foreground text-sm font-semibold truncate text-start">
                                  {item.name}
                                </h3>
                                <p className="text-muted-foreground text-xs mt-1 text-start">
                                  {item.productionYear}
                                  {/* Show different metadata based on source */}
                                  {item.source === "jellyfin" &&
                                    (item as any).runtimeTicks &&
                                    formatRuntime(
                                      Number((item as any).runtimeTicks)
                                    ) && (
                                      <>
                                        {" "}
                                        •{" "}
                                        {formatRuntime(
                                          Number((item as any).runtimeTicks)
                                        )}
                                      </>
                                    )}
                                  {item.source === "jellyseerr" &&
                                    item.communityRating && (
                                      <>
                                        {" "}
                                        • ⭐ {item.communityRating.toFixed(1)}
                                      </>
                                    )}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {/* Show genres differently based on source */}
                                {item.source === "jellyseerr" &&
                                  item.genres &&
                                  item.genres.slice(0, 2).map((genre) => (
                                    <Badge
                                      key={genre}
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0.5"
                                    >
                                      {genre}
                                    </Badge>
                                  ))}
                                {item.source === "jellyfin" &&
                                  (item as any).genres
                                    ?.slice(0, 2)
                                    .map((genre: string) => (
                                      <Badge
                                        key={genre}
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0.5"
                                      >
                                        {genre}
                                      </Badge>
                                    ))}
                              </div>
                            </div>

                            {/* Hide button - only for Jellyfin items for now */}
                            {item.source === "jellyfin" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleHideRecommendation(recommendation);
                                }}
                                disabled={hidingItems.has(item.id)}
                                className="absolute top-2 right-2 h-6 w-6 p-0 bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <EyeOffIcon className="h-3 w-3" />
                              </Button>
                            )}
                          </ItemLink>
                        </div>
                      );
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};
