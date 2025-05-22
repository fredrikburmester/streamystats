"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { MostWatchedItem, Server, Statistics } from "@/lib/db";
import { formatDuration } from "@/lib/utils";
import { MoreHorizontal, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Poster } from "./Poster";
import { usePersistantState } from "@/hooks/usePersistantState";
import { getExternalUrl } from "@/utils/getServerUrl";

interface Props {
  data: Statistics["most_watched_items"];
  server: Server;
}

// Local storage key
const STORAGE_KEY = "mostWatchedColumnsVisibility";

// Default column visibility state
const DEFAULT_VISIBILITY = {
  movies: true,
  series: true,
  episodes: true,
};

export const MostWatchedItems: React.FC<Props> = ({ data, server }) => {
  const [initialized, setInitialized] = useState(false);

  const [visibleColumns, setVisibleColumns] = usePersistantState<
    typeof DEFAULT_VISIBILITY
  >("mostWatchedColumnsVisibility", DEFAULT_VISIBILITY);

  const toggleColumn = (column: "movies" | "series" | "episodes") => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  // Calculate number of visible columns for grid
  const visibleColumnCount =
    Object.values(visibleColumns).filter(Boolean).length;
  const gridColsClass =
    visibleColumnCount === 1
      ? "md:grid-cols-1"
      : visibleColumnCount === 2
      ? "md:grid-cols-2"
      : "md:grid-cols-3";

  const renderItems = (
    items: MostWatchedItem[],
    type: "Movie" | "Episode" | "Series",
    title: string
  ) => (
    <div>
      <h2 className="text-xl font-bold mb-4">Most Watched {title}</h2>
      {items.length === 0 && (
        <p className="text-neutral-500">
          No {title.toLowerCase()} watched yet.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {items?.slice(0, 5).map((item, index) => (
          <a
            key={`${type}-${item.jellyfin_id || item.id || index}`}
            href={`${getExternalUrl(server)}/web/#/details?id=${
              item.jellyfin_id
            }`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-row items-center px-2 py-2 min-h-[120px] rounded-lg border border-border bg-card shadow-sm transition-transform transition-colors duration-200 hover:scale-[1.01] hover:bg-accent/60 group"
            style={{ textDecoration: "none" }}
          >
            <div className="rounded-lg overflow-hidden w-16 transition-transform duration-200 group-hover:scale-[1.03]">
              <Poster
                item={item}
                server={server}
                preferredImageType="Primary"
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex flex-row items-center justify-between space-y-0 py-1 px-2 relative">
                <div className="text-sm">
                  {item.type === "Episode" && (
                    <div className="flex gap-0.5 flex-col">
                      <p className="text-xs text-neutral-500 font-normal truncate">
                        {item.series_name}
                        {" - "}
                        <span className="text-xs text-neutral-500 font-normal truncate">
                          {`${item.season_name} - E${item.index_number}`}
                        </span>
                      </p>
                      <p className="truncate">{item.name}</p>
                    </div>
                  )}
                  {item.type === "Movie" && (
                    <div className="flex flex-col gap-0.5">
                      <p className="truncate">{item.name}</p>
                      <p className="text-xs text-neutral-500 font-normal">
                        {item.production_year}
                      </p>
                    </div>
                  )}
                  {item.type === "Series" && (
                    <div className="flex flex-col gap-0.5">
                      <p className="truncate">{item.name}</p>
                      <p className="text-xs text-neutral-500 font-normal">
                        {item.production_year}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-0 pb-2 px-2">
                <p className="text-xs font-semibold">
                  {formatDuration(item.total_play_duration || 0)}
                </p>
                <p className="text-neutral-500 text-xs">
                  Played {item.total_play_count} times
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={`grid ${gridColsClass} gap-4`}>
        {visibleColumns.movies &&
          renderItems(data?.Movie || [], "Movie", "Movies")}
        {visibleColumns.series &&
          renderItems(data?.Series || [], "Series", "Series")}
        {visibleColumns.episodes &&
          renderItems(data?.Episode || [], "Episode", "Episodes")}
      </div>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              <Settings className="h-4 w-4 mr-2" /> Display Options
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Visible Sections</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="p-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Movies</span>
                <Switch
                  checked={visibleColumns.movies}
                  onCheckedChange={() => toggleColumn("movies")}
                />
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Series</span>
                <Switch
                  checked={visibleColumns.series}
                  onCheckedChange={() => toggleColumn("series")}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Episodes</span>
                <Switch
                  checked={visibleColumns.episodes}
                  onCheckedChange={() => toggleColumn("episodes")}
                />
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setVisibleColumns(DEFAULT_VISIBILITY)}
              className="justify-center text-xs text-muted-foreground"
            >
              Reset to default
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
