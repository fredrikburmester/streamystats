"use client";

import { EyeOffIcon, Link2, type LucideIcon, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Poster } from "@/app/(app)/servers/[id]/(auth)/dashboard/Poster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ServerPublic } from "@/lib/types";
import type {
  RecommendationCardItem,
  RecommendationListItem,
} from "./recommendation-types";

interface RecommendationsSectionProps {
  title: string;
  description: string;
  icon: LucideIcon;
  recommendations: RecommendationListItem[];
  server: ServerPublic;
  onHideRecommendation: (
    serverId: string | number,
    itemId: string,
  ) => Promise<{
    success: boolean;
    error?: string | boolean;
    message?: string;
  }>;
  formatRuntime?: (ticks: number | null) => string | null;
  emptyMessage: string;
  fetchNextPage?: (offset: number) => Promise<RecommendationListItem[]>;
  /**
   * When true (default), an unset embedding provider shows a setup prompt.
   * Graph-based sections work without embeddings, so they pass false.
   */
  requiresEmbeddings?: boolean;
}

export function RecommendationsSection({
  title,
  description,
  icon: Icon,
  recommendations,
  server,
  onHideRecommendation,
  formatRuntime,
  emptyMessage,
  fetchNextPage,
  requiresEmbeddings = true,
}: RecommendationsSectionProps & {
  recommendations: RecommendationListItem[];
}) {
  const [items, setItems] = useState(recommendations);
  const [hidingItems, setHidingItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleHideRecommendation = async (
    recommendation: RecommendationListItem,
  ) => {
    const { item } = recommendation;
    if (!item.id || hidingItems.has(item.id)) {
      console.warn("Item already hidden or missing jellyfin_id", item);
      return;
    }

    const jellyfinId = item.id;
    setHidingItems((prev) => new Set(prev).add(jellyfinId));

    try {
      const result = await onHideRecommendation(server.id, jellyfinId);

      if (result.success) {
        setItems((prev) => prev.filter((rec) => rec.item.id !== jellyfinId));
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

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) return "text-green-500";
    if (similarity >= 0.6) return "text-blue-500";
    return "text-yellow-500";
  };

  useEffect(() => {
    setItems(recommendations);
    setHasMore(true);
  }, [recommendations]);

  useEffect(() => {
    if (!fetchNextPage || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && !isLoading && hasMore) {
          setIsLoading(true);
          fetchNextPage(items.length)
            .then((newItems) => {
              if (newItems.length === 0) {
                setHasMore(false);
              } else {
                setItems((prev) => [...prev, ...newItems]);
              }
            })
            .catch((error) => {
              console.error("Error fetching next page:", error);
            })
            .finally(() => {
              setIsLoading(false);
            });
        }
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0.1,
      },
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, items.length, isLoading, hasMore]);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg border bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50" />
        <div className="relative z-10">
          <div className="p-4 pb-3">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              {title}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <TrendingUp className="h-3 w-3" />
              {description}
            </p>
          </div>

          {requiresEmbeddings &&
          (!server.embeddingBaseUrl || !server.embeddingModel) ? (
            <div className="flex flex-col gap-2 px-4 pb-4">
              <Link
                href={`/servers/${server.id}/settings/ai`}
                className="w-full sm:w-auto"
              >
                <Button className="w-full sm:w-auto text-sm" size="sm">
                  Set up embedding provider
                </Button>
              </Link>
              <p className="opacity-70 text-xs">
                To get recommendations, you need to configure an embedding
                provider.
              </p>
            </div>
          ) : (
            <div className="">
              <ScrollArea dir="ltr" className="w-full py-1">
                <div className="flex gap-4 flex-nowrap px-4 w-max">
                  {items.map((recommendation) => {
                    const {
                      item,
                      basedOn = [],
                      similarity = 0,
                    } = recommendation;

                    return (
                      <div
                        key={item.id}
                        className="flex-shrink-0 group relative"
                      >
                        <div className="relative w-[152px] sm:w-[184px] py-2">
                          <div className="flex flex-col border border-border bg-card rounded-lg hover:border-primary/50 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:z-10 relative">
                            <Link
                              href={`/servers/${server.id}/library/${item.id}`}
                              className="block"
                            >
                              <div className="relative overflow-hidden rounded-t-lg">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                                <Poster
                                  item={item}
                                  server={server}
                                  width={184}
                                  height={240}
                                  preferredImageType="Primary"
                                  className="w-full h-[208px] sm:h-[256px]"
                                />
                                <div className="absolute top-2 left-2 z-20">
                                  <Badge
                                    className={`${getSimilarityColor(
                                      similarity,
                                    )} bg-background/90 backdrop-blur-sm border-0 shadow-lg text-xs px-1.5 py-0.5`}
                                  >
                                    <TrendingUp className="h-2.5 w-2.5 mr-1" />
                                    {Math.round(similarity * 100)}%
                                  </Badge>
                                </div>
                                {item.id && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleHideRecommendation(recommendation);
                                    }}
                                    disabled={hidingItems.has(item.id)}
                                    className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out bg-background/90 backdrop-blur-sm border-0 shadow-lg h-7 w-7 hover:w-[70px] p-0 group/btn overflow-hidden flex items-center justify-start"
                                  >
                                    <div className="flex items-center justify-center w-7 h-7 flex-shrink-0">
                                      <EyeOffIcon className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="text-xs font-medium opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 whitespace-nowrap pr-2">
                                      Hide
                                    </span>
                                  </Button>
                                )}
                              </div>

                              <div className="p-3 space-y-2 bg-gradient-to-b from-card to-card/95">
                                <div>
                                  <h3 className="text-foreground text-sm font-bold truncate">
                                    {item.name}
                                  </h3>
                                  <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1.5">
                                    {item.productionYear}
                                    {item.runtimeTicks &&
                                      formatRuntime &&
                                      formatRuntime(
                                        Number(item.runtimeTicks),
                                      ) && (
                                        <>
                                          <span>•</span>
                                          {formatRuntime(
                                            Number(item.runtimeTicks),
                                          )}
                                        </>
                                      )}
                                    {!formatRuntime &&
                                      item.type === "Series" && (
                                        <>
                                          <span>•</span>
                                          Series
                                        </>
                                      )}
                                  </p>
                                  {recommendation.reason && (
                                    <p className="text-muted-foreground/80 text-[10px] mt-1 italic line-clamp-2">
                                      {recommendation.reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </Link>

                            {basedOn.length > 0 && (
                              <div className="px-3 pb-3 space-y-1.5 pt-1.5 border-t border-border/50 bg-gradient-to-b from-card to-card/95">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Link2 className="h-2.5 w-2.5" />
                                  <span className="font-medium text-[10px]">
                                    Based on{" "}
                                    {basedOn.length === 1 ? "this" : "these"}:
                                  </span>
                                </div>
                                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                                  {basedOn
                                    .slice(0, 3)
                                    .map(
                                      (
                                        basedItem: RecommendationCardItem,
                                        idx: number,
                                      ) => (
                                        <TooltipProvider
                                          key={basedItem.id || idx}
                                        >
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Link
                                                href={`/servers/${server.id}/library/${basedItem.id}`}
                                                className="flex-shrink-0 group/based"
                                              >
                                                <div className="relative w-12 h-18 rounded overflow-hidden border border-border/50 hover:border-primary transition-colors">
                                                  <Poster
                                                    item={basedItem}
                                                    server={server}
                                                    width={48}
                                                    height={72}
                                                    preferredImageType="Primary"
                                                    className="w-full h-full rounded"
                                                  />
                                                  <div className="absolute inset-0 bg-primary/0 group-hover/based:bg-primary/10 transition-colors" />
                                                </div>
                                              </Link>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="font-medium text-xs">
                                                {basedItem.name}
                                              </p>
                                              {basedItem.productionYear && (
                                                <p className="text-[10px] text-muted-foreground">
                                                  {basedItem.productionYear}
                                                </p>
                                              )}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ),
                                    )}
                                  {basedOn.length > 3 && (
                                    <div className="flex-shrink-0 w-12 h-18 rounded border border-border/50 bg-muted flex items-center justify-center">
                                      <span className="text-[10px] text-muted-foreground">
                                        +{basedOn.length - 3}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {fetchNextPage && (
                    <div ref={sentinelRef} className="flex-shrink-0 w-4" />
                  )}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
