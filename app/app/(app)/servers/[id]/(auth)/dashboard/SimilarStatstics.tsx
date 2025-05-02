"use client";

import { getSimilarStatistics } from "@/lib/db/similar-statistics";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Film, Tv } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Poster } from "./Poster";
import { Item, Server } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Props {
  data: Item[];
  server: Server;
}

export const SimilarStatstics = ({ data, server }: Props) => {
  // Group items by type
  const groupedItems = data.reduce((acc: Record<string, Item[]>, item) => {
    acc[item.type] = acc[item.type] || [];

    // Only add if we don't have 5 yet
    if (acc[item.type].length < 5) {
      acc[item.type].push(item);
    }

    return acc;
  }, {});

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

  if (data.length === 0) {
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
      <CardHeader>
        <CardTitle>Recommended Content</CardTitle>
        <CardDescription>Based on your viewing habits</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-4">
            {types.map((type) => (
              <TabsTrigger key={type} value={type.toLowerCase()}>
                {type === "Movie" ? (
                  <Film className="h-4 w-4 mr-2" />
                ) : (
                  <Tv className="h-4 w-4 mr-2" />
                )}
                {type}
              </TabsTrigger>
            ))}
          </TabsList>

          {!server.open_ai_api_token || server.open_ai_api_token === "" ? (
            <div className="flex flex-col gap-2 mb-4">
              <Link href={`/servers/${server.id}/settings`}>
                <Button>Set up OpenAI API key</Button>
              </Link>
              <p className="opacity-70 text-xs">
                To get recommendations, you need to set up an OpenAI API key.
              </p>
            </div>
          ) : null}

          {types.map((type) => (
            <TabsContent key={type} value={type.toLowerCase()} className="">
              <div className="grid grid-cols-4 gap-4">
                {groupedItems[type].map((item) => (
                  <Link
                    key={item.id}
                    href={`${server.url}/web/index.html#!/details?id=${item.jellyfin_id}`}
                    className="hover:opacity-50 transition-opacity"
                  >
                    <Card className="flex-shrink-0 flex-1">
                      <div className="relative h-40 overflow-hidden">
                        <Poster
                          item={item}
                          server={server}
                          className="w-full"
                        />
                      </div>

                      <CardHeader className="p-3">
                        <CardTitle className="text-base truncate">
                          {item.name}
                        </CardTitle>
                        <div className="flex gap-2 flex-wrap">
                          {item.production_year && (
                            <Badge variant="outline">
                              {item.production_year}
                            </Badge>
                          )}
                          {item.runtime_ticks && (
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              <Clock className="h-3 w-3" />
                              {formatRuntime(Number(item.runtime_ticks))}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="px-3 pb-1">
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {item.overview || "No description available"}
                        </p>
                      </CardContent>

                      <CardFooter className="px-3 pb-3">
                        <div className="flex flex-wrap gap-1">
                          {item.genres?.slice(0, 2).map((genre) => (
                            <Badge
                              key={genre}
                              variant="secondary"
                              className="text-xs"
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
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
