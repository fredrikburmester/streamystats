"use client";

import {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogDescription,
  MorphingDialogImage,
  MorphingDialogSubtitle,
  MorphingDialogTitle,
  MorphingDialogTrigger,
} from "@/components/motion-primitives/morphing-dialog";
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
import {
  hideSeriesRecommendation,
  SeriesRecommendationItem,
} from "@/lib/db/similar-series-statistics";
import { Server } from "@streamystats/database";
import { ExternalLink, EyeOffIcon, Monitor } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  data: SeriesRecommendationItem[];
  server: Server;
}

export const SimilarSeriesStatistics = ({ data, server }: Props) => {
  const [recommendations, setRecommendations] = useState(data);
  const [hidingItems, setHidingItems] = useState<Set<string>>(new Set());

  const handleHideRecommendation = async (
    recommendation: SeriesRecommendationItem
  ) => {
    const { item } = recommendation;
    if (!item.id || hidingItems.has(item.id)) {
      console.warn("Item already hidden or missing jellyfin_id", item);
      return;
    }

    const jellyfinId = item.id;
    setHidingItems((prev) => new Set(prev).add(jellyfinId));

    try {
      const result = await hideSeriesRecommendation(server.id, jellyfinId);

      if (result.success) {
        // Remove the recommendation from recommendations
        setRecommendations((prev) =>
          prev.filter((rec) => rec.item.id !== jellyfinId)
        );
        toast.success("Series recommendation hidden successfully");
      } else {
        toast.error(result.error || "Failed to hide series recommendation");
      }
    } catch (error) {
      console.error("Error hiding series recommendation:", error);
      toast.error("Failed to hide series recommendation");
    } finally {
      setHidingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(jellyfinId);
        return newSet;
      });
    }
  };

  if (
    !recommendations ||
    !Array.isArray(recommendations) ||
    recommendations.length === 0
  ) {
    return (
      <Card>
        <CardHeader className="">
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Recommended Series
          </CardTitle>
          <CardDescription>
            No series recommendations available yet
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col max-w-full">
      <CardHeader className="px-4 sm:px-6 mb-0 pb-0">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Recommended Series for You
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Based on the series you've been watching
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
              To get series recommendations, you need to set up an OpenAI API
              key.
            </p>
          </div>
        ) : (
          <ScrollArea className="py-4">
            <div className="flex gap-4 min-w-full w-max">
              {recommendations.map((recommendation) => {
                const item = recommendation.item;
                return (
                  <MorphingDialog
                    key={item.id || `${item.name}-${item.productionYear}`}
                    transition={{
                      type: "spring",
                      bounce: 0.05,
                      duration: 0.25,
                    }}
                  >
                    <MorphingDialogTrigger
                      style={{
                        borderRadius: "12px",
                      }}
                      className="flex w-[200px] sm:w-[240px] flex-col overflow-hidden border border-zinc-50/10 bg-zinc-900 hover:opacity-80 transition-opacity"
                    >
                      <MorphingDialogImage
                        src={`${server.url}/Items/${item.id}/Images/Primary?maxHeight=300&quality=90`}
                        alt={item.name || "Series poster"}
                        className="h-48 sm:h-56 w-full object-cover"
                      />
                      <div className="flex grow flex-col justify-between p-3">
                        <div>
                          <MorphingDialogTitle className="text-zinc-50 text-sm font-semibold truncate text-start">
                            {item.name}
                          </MorphingDialogTitle>
                          <MorphingDialogSubtitle className="text-zinc-400 text-xs mt-1 text-start">
                            {item.productionYear && `${item.productionYear} • `}
                            Series
                          </MorphingDialogSubtitle>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.genres?.slice(0, 2).map((genre: string) => (
                            <Badge
                              key={genre}
                              variant="secondary"
                              className="text-xs px-1.5 py-0"
                            >
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </MorphingDialogTrigger>

                    <MorphingDialogContainer>
                      <MorphingDialogContent
                        style={{
                          borderRadius: "24px",
                        }}
                        className="pointer-events-auto relative flex h-auto w-full flex-col overflow-hidden border border-zinc-50/10 bg-zinc-900 sm:w-[500px] max-h-[90vh]"
                      >
                        <div className="flex-shrink-0">
                          <MorphingDialogImage
                            src={`${server.url}/Items/${item.id}/Images/Primary?maxHeight=400&quality=90`}
                            alt={item.name || "Series poster"}
                            className="h-64 sm:h-80 w-full object-cover"
                          />
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1 mr-3">
                              <MorphingDialogTitle className="text-2xl text-zinc-50 font-bold">
                                {item.name}
                              </MorphingDialogTitle>
                            </div>
                            {item.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleHideRecommendation(recommendation)
                                }
                                disabled={hidingItems.has(item.id)}
                                className="flex items-center gap-2 text-zinc-300 border-zinc-600 hover:text-zinc-100 hover:border-zinc-500"
                              >
                                <EyeOffIcon className="h-4 w-4" />
                                {hidingItems.has(item.id)
                                  ? "Hiding..."
                                  : "Hide"}
                              </Button>
                            )}
                          </div>

                          <div className="flex gap-2 flex-wrap mt-2 mb-4">
                            {item.productionYear && (
                              <Badge variant="outline" className="text-xs">
                                {item.productionYear}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              Series
                            </Badge>
                            {item.genres?.map((genre) => (
                              <Badge
                                key={genre}
                                variant="secondary"
                                className="text-xs"
                              >
                                {genre}
                              </Badge>
                            ))}
                          </div>

                          <MorphingDialogDescription
                            disableLayoutAnimation
                            variants={{
                              initial: { opacity: 0, scale: 0.8, y: 100 },
                              animate: { opacity: 1, scale: 1, y: 0 },
                              exit: { opacity: 0, scale: 0.8, y: 100 },
                            }}
                          >
                            {/* Show "based on" information if available */}
                            {recommendation.basedOn &&
                              recommendation.basedOn.length > 0 && (
                                <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                                  <p className="text-zinc-300 text-sm font-medium mb-2">
                                    We recommend this series because you
                                    watched:
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {recommendation.basedOn
                                      .slice(0, 3)
                                      .map((basedOnItem, index) => (
                                        <Badge
                                          key={basedOnItem.id || index}
                                          variant="outline"
                                          className="text-xs text-zinc-200 border-zinc-600"
                                        >
                                          {basedOnItem.name}
                                          {basedOnItem.productionYear &&
                                            ` (${basedOnItem.productionYear})`}
                                        </Badge>
                                      ))}
                                  </div>
                                </div>
                              )}

                            <p className="mt-2 text-zinc-400 text-sm leading-relaxed">
                              {item.overview ||
                                "No description available for this series."}
                            </p>

                            <a
                              className="mt-4 inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200 underline text-sm"
                              href={`${server.url}/web/index.html#!/details?id=${item.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open in Jellyfin
                            </a>
                          </MorphingDialogDescription>
                        </div>

                        <MorphingDialogClose className="text-zinc-400 hover:text-zinc-200" />
                      </MorphingDialogContent>
                    </MorphingDialogContainer>
                  </MorphingDialog>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
