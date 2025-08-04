"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { usePersistantState } from "@/hooks/usePersistantState";
import { formatDuration } from "@/lib/utils";
import { Item, Server } from "@streamystats/database/schema";
import { Settings } from "lucide-react";
import { useState, useTransition } from "react";
import { Poster } from "./Poster";
import Link from "next/link";
import { DateRangePicker } from "./DateRangePicker";
import { Skeleton } from "@/components/ui/skeleton";
import { getFilteredMostWatchedItems } from "./actions";

interface ItemWithStats extends Item {
  totalPlayCount: number;
  totalPlayDuration: number;
}

interface Props {
  initialData: {
    Movie: ItemWithStats[];
    Episode: ItemWithStats[];
    Series: ItemWithStats[];
  };
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

export const MostWatchedItems: React.FC<Props> = ({ initialData, server }) => {
  const [data, setData] = useState(initialData);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const [visibleColumns, setVisibleColumns] = usePersistantState<
    typeof DEFAULT_VISIBILITY
  >("mostWatchedColumnsVisibility", DEFAULT_VISIBILITY);

  const toggleColumn = (column: "movies" | "series" | "episodes") => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  const fetchFilteredData = async (start?: Date, end?: Date) => {
    setIsLoading(true);
    try {
      const result = await getFilteredMostWatchedItems(
        server.id.toString(),
        start?.toISOString(),
        end?.toISOString()
      );

      if (result.success && result.data) {
        setData(result.data);
      } else {
        console.error("Error fetching filtered data:", result.error);
      }
    } catch (error) {
      console.error("Error fetching filtered data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (type: "start" | "end", date: Date | undefined) => {
    if (type === "start") {
      setStartDate(date);
      startTransition(() => {
        fetchFilteredData(date, endDate);
      });
    } else {
      setEndDate(date);
      startTransition(() => {
        fetchFilteredData(startDate, date);
      });
    }
  };

  const handlePresetChange = (preset: string) => {
    // The DateRangePicker handles the preset logic internally
  };

  const handleClearDates = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setData(initialData);
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
    items: ItemWithStats[],
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
          <Link
            href={`/servers/${server.id}/library/${item.id}`}
            key={`${type}-${item.id || item.id || index}`}
            className="flex flex-row items-center px-2 py-2 min-h-[120px] rounded-lg border border-border bg-card shadow-sm duration-200 hover:bg-accent/60 group"
            style={{ textDecoration: "none" }}
          >
            <div className="rounded-lg overflow-hidden w-16 transition-transform duration-200">
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
                        {item.seriesName}
                        {" - "}
                        <span className="text-xs text-neutral-500 font-normal truncate">
                          {`${item.seasonName} - E${item.indexNumber}`}
                        </span>
                      </p>
                      <p className="truncate">{item.name}</p>
                    </div>
                  )}
                  {item.type === "Movie" && (
                    <div className="flex flex-col gap-0.5">
                      <p className="truncate">{item.name}</p>
                      <p className="text-xs text-neutral-500 font-normal">
                        {item.productionYear}
                      </p>
                    </div>
                  )}
                  {item.type === "Series" && (
                    <div className="flex flex-col gap-0.5">
                      <p className="truncate">{item.name}</p>
                      <p className="text-xs text-neutral-500 font-normal">
                        {item.productionYear}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-0 pb-2 px-2">
                <p className="text-xs font-semibold">
                  {formatDuration(item.totalPlayDuration || 0)}
                </p>
                <p className="text-neutral-500 text-xs">
                  Played {item.totalPlayCount} times
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h2 className="text-2xl font-bold">Most Watched Items</h2>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
            onPresetChange={handlePresetChange}
            onClearDates={handleClearDates}
          />
        </div>
        
        {(isLoading || isPending) && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
      </div>

      {!(isLoading || isPending) && (
        <div className={`grid ${gridColsClass} gap-4`}>
          {visibleColumns.movies &&
            renderItems(data?.Movie || [], "Movie", "Movies")}
          {visibleColumns.series &&
            renderItems(data?.Series || [], "Series", "Series")}
          {visibleColumns.episodes &&
            renderItems(data?.Episode || [], "Episode", "Episodes")}
        </div>
      )}

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
