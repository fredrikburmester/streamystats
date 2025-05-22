"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { Item, Server, getExternalUrl } from "@/lib/db";
import { ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Poster } from "./Poster";

interface Props {
  data: Item[];
  server: Server;
}

export const SimilarStatstics = ({ data, server }: Props) => {
  const [showAllItems, setShowAllItems] = useState<Record<string, boolean>>({});
  const isMobile = useIsMobile();

  // Group items by type
  const groupedItems = Array.isArray(data)
    ? data.reduce((acc: Record<string, Item[]>, item) => {
        if (!item || !item.type) return acc;

        acc[item.type] = acc[item.type] || [];

        // Only add if we don't have 5 yet
        if (acc[item.type].length < 5) {
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

  const toggleShowMore = (type: string) => {
    setShowAllItems((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recommended Content</CardTitle>
          <CardDescription>No recommendations available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="flex-1">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl">
          Recommended Content
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Based on your viewing habits
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <Tabs defaultValue={defaultTab}>
          {/* <TabsList className="mb-4 w-full justify-start overflow-x-auto">
            {types.map((type) => (
              <TabsTrigger key={type} value={type.toLowerCase()} className="flex-shrink-0">
                {type === "Movie" ? (
                  <Film className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                ) : (
                  <Tv className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                )}
                <span className="truncate">{type}</span>
              </TabsTrigger>
            ))}
          </TabsList> */}

          {!server.open_ai_api_token || server.open_ai_api_token === "" ? (
            <div className="flex flex-col gap-2 mb-4 max-w-full">
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
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                {groupedItems[type]
                  .slice(
                    0,
                    showAllItems[type]
                      ? groupedItems[type].length
                      : isMobile
                      ? 2
                      : 3
                  )
                  .map((item) => (
                    <Link
                      key={item.id}
                      href={`${getExternalUrl(
                        server
                      )}/web/index.html#!/details?id=${item.jellyfin_id}`}
                      className="hover:opacity-50 transition-opacity"
                    >
                      <Card className="flex-shrink-0 h-full flex flex-col">
                        <div className="relative h-32 sm:h-36 md:h-40 overflow-hidden">
                          <Poster
                            item={item}
                            server={server}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <CardHeader className="p-2 sm:p-3">
                          <CardTitle className="text-sm sm:text-base truncate">
                            {item.name}
                          </CardTitle>
                          <div className="flex gap-1 sm:gap-2 flex-wrap">
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
                          </div>
                        </CardHeader>

                        <CardContent className="px-2 sm:px-3 pb-1 flex-grow">
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3">
                            {item.overview || "No description available"}
                          </p>
                        </CardContent>

                        <CardFooter className="px-2 sm:px-3 pb-2 sm:pb-3">
                          <div className="flex flex-wrap gap-1">
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
                        </CardFooter>
                      </Card>
                    </Link>
                  ))}
              </div>

              {groupedItems[type].length > (isMobile ? 2 : 3) && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleShowMore(type)}
                    className="flex items-center gap-1 text-xs sm:text-sm w-full xs:w-auto"
                  >
                    {showAllItems[type]
                      ? "Show less"
                      : `See all ${groupedItems[type].length} recommendations`}
                    <ChevronRight
                      className={`h-3 w-3 transition-transform ${
                        showAllItems[type] ? "rotate-90" : ""
                      }`}
                    />
                  </Button>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
