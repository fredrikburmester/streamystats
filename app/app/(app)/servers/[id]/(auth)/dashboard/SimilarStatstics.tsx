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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { Item, Server } from "@/lib/db";
import { Clock, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Props {
  data: Item[];
  server: Server;
}

export const SimilarStatstics = ({ data, server }: Props) => {
  const isMobile = useIsMobile();

  // Group items by type
  const groupedItems = Array.isArray(data)
    ? data.reduce((acc: Record<string, Item[]>, item) => {
        if (!item || !item.type) return acc;

        acc[item.type] = acc[item.type] || [];

        // Only add if we don't have 20 yet
        if (acc[item.type].length < 20) {
          acc[item.type].push(item);
        }

        return acc;
      }, {})
    : {};

  // Get unique types
  const types = Object.keys(groupedItems);

  // Default to first type if available
  const defaultTab = types.length > 0 ? types[0].toLowerCase() : "all";

  // Format runtime from ticks to hours and minutes
  const formatRuntime = (ticks: number | null) => {
    if (!ticks) return null;
    const minutes = Math.floor(ticks / 600000000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes > 0 ? `${remainingMinutes}m` : ""}`;
    }
    return `${minutes}m`;
  };

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <Card>
        <CardHeader className="mb-0 pb-0">
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
          Recommended Content
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Based on your viewing habits
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 m-0 pt-0 max-w-full overflow-hidden">
        <Tabs defaultValue={defaultTab}>
          {(!server.open_ai_api_token || server.open_ai_api_token === "") &&
          server.embedding_provider === "openai" ? (
            <div className="flex flex-col gap-2 max-w-full">
              <Link
                href={`/servers/${server.id}/settings`}
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
          ) : null}

          {types.map((type) => (
            <TabsContent key={type} value={type.toLowerCase()} className="">
              {/* Horizontal scrollable container */}
              <div className="overflow-x-auto pt-4">
                <div className="flex gap-4 min-w-full w-max">
                  {groupedItems[type].map((item) => (
                    <MorphingDialog
                      key={item.id}
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
                          src={`${server.url}/Items/${item.jellyfin_id}/Images/Primary?maxHeight=300&quality=90`}
                          alt={item.name || "Movie poster"}
                          className="h-48 sm:h-56 w-full object-cover"
                        />
                        <div className="flex grow flex-col justify-between p-3">
                          <div>
                            <MorphingDialogTitle className="text-zinc-50 text-sm font-semibold truncate text-start">
                              {item.name}
                            </MorphingDialogTitle>
                            <MorphingDialogSubtitle className="text-zinc-400 text-xs mt-1 text-start">
                              {item.production_year}
                              {item.runtime_ticks &&
                                formatRuntime(Number(item.runtime_ticks)) && (
                                  <>
                                    {" "}
                                    •{" "}
                                    {formatRuntime(Number(item.runtime_ticks))}
                                  </>
                                )}
                            </MorphingDialogSubtitle>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.genres?.slice(0, 2).map((genre) => (
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
                              src={`${server.url}/Items/${item.jellyfin_id}/Images/Primary?maxHeight=400&quality=90`}
                              alt={item.name || "Movie poster"}
                              className="h-64 sm:h-80 w-full object-cover"
                            />
                          </div>

                          <div className="p-6 flex-1 overflow-y-auto">
                            <MorphingDialogTitle className="text-2xl text-zinc-50 font-bold">
                              {item.name}
                            </MorphingDialogTitle>

                            <div className="flex gap-2 flex-wrap mt-2 mb-4">
                              {item.production_year && (
                                <Badge variant="outline" className="text-xs">
                                  {item.production_year}
                                </Badge>
                              )}
                              {item.runtime_ticks && (
                                <Badge
                                  variant="outline"
                                  className="flex items-center gap-1 text-xs"
                                >
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatRuntime(Number(item.runtime_ticks))}
                                </Badge>
                              )}
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
                              {item.based_on && item.based_on.length > 0 && (
                                <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                                  <p className="text-zinc-300 text-sm font-medium mb-2">
                                    We recommend this because you watched:
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {item.based_on
                                      .slice(0, 3)
                                      .map((basedOnItem, index) => (
                                        <Badge
                                          key={basedOnItem.jellyfin_id || index}
                                          variant="outline"
                                          className="text-xs text-zinc-200 border-zinc-600"
                                        >
                                          {basedOnItem.name}
                                          {basedOnItem.production_year &&
                                            ` (${basedOnItem.production_year})`}
                                        </Badge>
                                      ))}
                                  </div>
                                </div>
                              )}

                              <p className="mt-2 text-zinc-400 text-sm leading-relaxed">
                                {item.overview ||
                                  "No description available for this item."}
                              </p>

                              <a
                                className="mt-4 inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200 underline text-sm"
                                href={`${server.url}/web/index.html#!/details?id=${item.jellyfin_id}`}
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
                  ))}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
