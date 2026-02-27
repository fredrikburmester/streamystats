"use client";

import {
  Check,
  Clock,
  ExternalLink,
  Film,
  Loader2,
  MoreHorizontal,
  Plus,
  Sparkles,
  Tv,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Poster } from "@/app/(app)/servers/[id]/(auth)/dashboard/Poster";
import { MarkAsWatchedMenuItem } from "@/components/MarkAsWatchedMenuItem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { getRecentlyAddedSeriesWithEpisodes } from "@/lib/db/recently-added";
import type { RecentlyAddedSeriesGroup } from "@/lib/db/recently-added-types";
import type { ServerPublic } from "@/lib/types";

interface WatchlistInfo {
  id: number;
  name: string;
  itemCount: number;
  allowedItemType: string | null;
}

interface RecentlyAddedSeriesProps {
  items: RecentlyAddedSeriesGroup[];
  server: ServerPublic;
  userId: string;
}

export function RecentlyAddedSeries({
  items: initialItems,
  server,
  userId,
}: RecentlyAddedSeriesProps) {
  const [items, setItems] = useState(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Watchlist state
  const [watchlists, setWatchlists] = useState<WatchlistInfo[]>([]);
  const [watchlistsLoading, setWatchlistsLoading] = useState(false);
  const [itemWatchlists, setItemWatchlists] = useState<
    Record<string, number[]>
  >({});
  const [addingToWatchlist, setAddingToWatchlist] = useState<string | null>(
    null,
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForItemId, setCreateForItemId] = useState<string | null>(null);
  const [createForItemIds, setCreateForItemIds] = useState<string[]>([]);
  const [createDialogType, setCreateDialogType] = useState<
    "series" | "episodes"
  >("series");
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchWatchlists = async () => {
    if (watchlists.length > 0) return;
    setWatchlistsLoading(true);
    try {
      const res = await fetch("/api/watchlists");
      if (res.ok) {
        const { data } = await res.json();
        setWatchlists(data);
      }
    } finally {
      setWatchlistsLoading(false);
    }
  };

  const fetchItemWatchlists = async (itemIds: string[]) => {
    const idsToFetch = itemIds.filter((id) => !itemWatchlists[id]);
    if (idsToFetch.length === 0) return;

    try {
      const newWatchlistData: Record<string, number[]> = {};
      for (const itemId of idsToFetch) {
        newWatchlistData[itemId] = [];
      }

      for (const wl of watchlists) {
        const itemRes = await fetch(`/api/watchlists/${wl.id}/items`);
        if (itemRes.ok) {
          const { data: wlData } = await itemRes.json();
          for (const itemId of idsToFetch) {
            if (
              wlData.items.some(
                (i: { item: { id: string } }) => i.item.id === itemId,
              )
            ) {
              newWatchlistData[itemId].push(wl.id);
            }
          }
        }
      }

      setItemWatchlists((prev) => ({ ...prev, ...newWatchlistData }));
    } catch (error) {
      console.error("Error fetching item watchlists:", error);
    }
  };

  const handleAddToWatchlist = async (itemId: string, watchlistId: number) => {
    const inWatchlists = itemWatchlists[itemId] || [];
    setAddingToWatchlist(`${itemId}-${watchlistId}`);

    try {
      if (inWatchlists.includes(watchlistId)) {
        const res = await fetch(
          `/api/watchlists/${watchlistId}/items/${itemId}`,
          {
            method: "DELETE",
          },
        );
        if (res.ok) {
          setItemWatchlists((prev) => ({
            ...prev,
            [itemId]: (prev[itemId] || []).filter((id) => id !== watchlistId),
          }));
          toast.success("Removed from watchlist");
        }
      } else {
        const res = await fetch(`/api/watchlists/${watchlistId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId }),
        });
        if (res.ok) {
          setItemWatchlists((prev) => ({
            ...prev,
            [itemId]: [...(prev[itemId] || []), watchlistId],
          }));
          toast.success("Added to watchlist");
        }
      }
    } catch (error) {
      console.error("Error updating watchlist:", error);
      toast.error("Failed to update watchlist");
    } finally {
      setAddingToWatchlist(null);
    }
  };

  const handleAddEpisodesToWatchlist = async (
    episodeIds: string[],
    watchlistId: number,
  ) => {
    setAddingToWatchlist(`episodes-${watchlistId}`);

    try {
      let addedCount = 0;
      for (const episodeId of episodeIds) {
        const inWatchlists = itemWatchlists[episodeId] || [];
        if (!inWatchlists.includes(watchlistId)) {
          const res = await fetch(`/api/watchlists/${watchlistId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId: episodeId }),
          });
          if (res.ok) {
            setItemWatchlists((prev) => ({
              ...prev,
              [episodeId]: [...(prev[episodeId] || []), watchlistId],
            }));
            addedCount++;
          }
        }
      }
      if (addedCount > 0) {
        toast.success(
          `Added ${addedCount} episode${addedCount > 1 ? "s" : ""} to watchlist`,
        );
      } else {
        toast.info("Episodes already in watchlist");
      }
    } catch (error) {
      console.error("Error adding episodes to watchlist:", error);
      toast.error("Failed to add episodes to watchlist");
    } finally {
      setAddingToWatchlist(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newWatchlistName.trim()) return;
    if (createDialogType === "series" && !createForItemId) return;
    if (createDialogType === "episodes" && createForItemIds.length === 0)
      return;

    setCreating(true);
    try {
      const res = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWatchlistName.trim(),
        }),
      });

      if (res.ok) {
        const { data: newWatchlist } = await res.json();
        setWatchlists((prev) => [...prev, newWatchlist]);

        if (createDialogType === "series" && createForItemId) {
          await fetch(`/api/watchlists/${newWatchlist.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId: createForItemId }),
          });

          setItemWatchlists((prev) => ({
            ...prev,
            [createForItemId]: [
              ...(prev[createForItemId] || []),
              newWatchlist.id,
            ],
          }));
          toast.success("Created watchlist and added series");
        } else if (createDialogType === "episodes") {
          for (const episodeId of createForItemIds) {
            await fetch(`/api/watchlists/${newWatchlist.id}/items`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemId: episodeId }),
            });

            setItemWatchlists((prev) => ({
              ...prev,
              [episodeId]: [...(prev[episodeId] || []), newWatchlist.id],
            }));
          }
          toast.success(
            `Created watchlist and added ${createForItemIds.length} episode${createForItemIds.length > 1 ? "s" : ""}`,
          );
        }

        setShowCreateDialog(false);
        setNewWatchlistName("");
        setCreateForItemId(null);
        setCreateForItemIds([]);
      }
    } catch (error) {
      console.error("Error creating watchlist:", error);
      toast.error("Failed to create watchlist");
    } finally {
      setCreating(false);
    }
  };

  const openInJellyfin = (itemId: string) => {
    const jellyfinUrl = `${server.url}/web/index.html#!/details?id=${itemId}`;
    window.open(jellyfinUrl, "_blank");
  };

  const getCompatibleWatchlists = (itemType: string) => {
    return watchlists.filter(
      (wl) => !wl.allowedItemType || wl.allowedItemType === itemType,
    );
  };

  const getBadgeText = (group: RecentlyAddedSeriesGroup): string => {
    if (group.isNewSeries) {
      return "New Series";
    }
    if (group.newEpisodeCount === 1 && group.latestEpisode) {
      const ep = group.latestEpisode;
      if (ep.seasonNumber !== null && ep.episodeNumber !== null) {
        return `S${ep.seasonNumber}E${ep.episodeNumber}`;
      }
      return "New Episode";
    }
    return `${group.newEpisodeCount} New Episodes`;
  };

  const getSubtitle = (group: RecentlyAddedSeriesGroup): string | null => {
    if (group.isNewSeries) {
      return `${group.newEpisodeCount} episode${group.newEpisodeCount !== 1 ? "s" : ""}`;
    }
    if (group.newEpisodeCount === 1 && group.latestEpisode) {
      return group.latestEpisode.name;
    }
    return null;
  };

  const getItemLink = (group: RecentlyAddedSeriesGroup): string => {
    if (
      group.newEpisodeCount === 1 &&
      group.latestEpisode &&
      !group.isNewSeries
    ) {
      return `/servers/${server.id}/library/${group.latestEpisode.id}`;
    }
    return `/servers/${server.id}/library/${group.series.id}`;
  };

  const getEpisodeLabel = (group: RecentlyAddedSeriesGroup): string => {
    if (group.newEpisodeCount === 1) {
      return "Add Episode to Watchlist";
    }
    return `Add ${group.newEpisodeCount} Episodes to Watchlist`;
  };

  useEffect(() => {
    setItems(initialItems);
    setHasMore(true);
  }, [initialItems]);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && !isLoading && hasMore) {
          setIsLoading(true);
          getRecentlyAddedSeriesWithEpisodes(server.id, 7, 20, items.length)
            .then((result) => {
              if (!result || result.length === 0) {
                setHasMore(false);
              } else {
                setItems((prev) => [...prev, ...result]);
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
  }, [server.id, items.length, isLoading, hasMore]);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <>
      <div>
        <div className="rounded-lg border bg-gradient-to-r from-purple-500/10 via-fuchsia-500/5 to-purple-500/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent opacity-50" />
          <div className="relative z-10">
            <div className="p-4 pb-3">
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-background/50 text-purple-500">
                  <Tv className="h-4 w-4" />
                </div>
                <span>Recently Added Series</span>
                <Badge
                  variant="outline"
                  className="ml-2 text-[10px] bg-purple-500/20 text-purple-400 border-0"
                >
                  New
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <Sparkles className="h-3 w-3" />
                Latest series and episodes added to your library
              </p>
            </div>

            <div className="">
              <ScrollArea dir="ltr" className="w-full py-1">
                <div className="flex gap-4 flex-nowrap px-4 w-max">
                  {items.map((group) => {
                    const seriesId = group.series.id;
                    const episodeIds = group.recentEpisodes.map((ep) => ep.id);
                    const seriesInWatchlists = itemWatchlists[seriesId] || [];
                    const seriesWatchlists = getCompatibleWatchlists("Series");
                    const episodeWatchlists =
                      getCompatibleWatchlists("Episode");
                    const badgeText = getBadgeText(group);
                    const subtitle = getSubtitle(group);
                    const itemLink = getItemLink(group);

                    return (
                      <div
                        key={group.series.id}
                        className="flex-shrink-0 group relative"
                      >
                        <div className="relative w-[152px] sm:w-[184px] py-2">
                          <div className="flex flex-col overflow-hidden border border-border bg-card rounded-lg hover:border-primary/50 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:z-10 relative">
                            <Link href={itemLink}>
                              <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                                <Poster
                                  item={group.series}
                                  server={server}
                                  width={184}
                                  height={240}
                                  preferredImageType="Primary"
                                  className="w-full h-[208px] sm:h-[256px] rounded-t-lg"
                                />
                                <div className="absolute top-2 left-2 z-20">
                                  <Badge
                                    className={`backdrop-blur-md border-0 shadow-lg text-xs font-medium px-1.5 py-0.5 ${
                                      group.isNewSeries
                                        ? "bg-green-600/90 text-white"
                                        : group.newEpisodeCount === 1
                                          ? "bg-purple-600/90 text-white"
                                          : "bg-blue-600/90 text-white"
                                    }`}
                                  >
                                    <Clock className="h-2.5 w-2.5 mr-1" />
                                    {badgeText}
                                  </Badge>
                                </div>
                              </div>
                            </Link>

                            <DropdownMenu
                              onOpenChange={(open) => {
                                if (open) {
                                  fetchWatchlists();
                                  if (watchlists.length > 0) {
                                    fetchItemWatchlists([
                                      seriesId,
                                      ...episodeIds,
                                    ]);
                                  }
                                }
                              }}
                            >
                              <DropdownMenuContent align="end" className="w-64">
                                <MarkAsWatchedMenuItem
                                  itemId={seriesId}
                                  serverId={server.id}
                                  userId={userId}
                                />
                                <DropdownMenuSeparator />
                                {/* Add Series to Watchlist */}
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>
                                    <Tv className="h-4 w-4 mr-2" />
                                    Add Series to Watchlist
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="w-48">
                                    {watchlistsLoading ? (
                                      <div className="flex items-center justify-center py-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      </div>
                                    ) : seriesWatchlists.length === 0 ? (
                                      <div className="px-2 py-2 text-sm text-muted-foreground text-center">
                                        No compatible watchlists
                                      </div>
                                    ) : (
                                      seriesWatchlists.map((wl) => (
                                        <DropdownMenuItem
                                          key={wl.id}
                                          onClick={() =>
                                            handleAddToWatchlist(
                                              seriesId,
                                              wl.id,
                                            )
                                          }
                                          disabled={
                                            addingToWatchlist ===
                                            `${seriesId}-${wl.id}`
                                          }
                                          className="flex items-center justify-between"
                                        >
                                          <span className="truncate">
                                            {wl.name}
                                          </span>
                                          {addingToWatchlist ===
                                          `${seriesId}-${wl.id}` ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : seriesInWatchlists.includes(
                                              wl.id,
                                            ) ? (
                                            <Check className="h-4 w-4 text-primary" />
                                          ) : null}
                                        </DropdownMenuItem>
                                      ))
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setCreateForItemId(seriesId);
                                        setCreateDialogType("series");
                                        setShowCreateDialog(true);
                                      }}
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Create new watchlist
                                    </DropdownMenuItem>
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>

                                {/* Add Episode(s) to Watchlist */}
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>
                                    <Film className="h-4 w-4 mr-2" />
                                    {getEpisodeLabel(group)}
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="w-48">
                                    {watchlistsLoading ? (
                                      <div className="flex items-center justify-center py-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      </div>
                                    ) : episodeWatchlists.length === 0 ? (
                                      <div className="px-2 py-2 text-sm text-muted-foreground text-center">
                                        No compatible watchlists
                                      </div>
                                    ) : (
                                      episodeWatchlists.map((wl) => (
                                        <DropdownMenuItem
                                          key={wl.id}
                                          onClick={() =>
                                            handleAddEpisodesToWatchlist(
                                              episodeIds,
                                              wl.id,
                                            )
                                          }
                                          disabled={
                                            addingToWatchlist ===
                                            `episodes-${wl.id}`
                                          }
                                          className="flex items-center justify-between"
                                        >
                                          <span className="truncate">
                                            {wl.name}
                                          </span>
                                          {addingToWatchlist ===
                                          `episodes-${wl.id}` ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : null}
                                        </DropdownMenuItem>
                                      ))
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setCreateForItemIds(episodeIds);
                                        setCreateDialogType("episodes");
                                        setShowCreateDialog(true);
                                      }}
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Create new watchlist
                                    </DropdownMenuItem>
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  onClick={() => openInJellyfin(seriesId)}
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Open in Jellyfin
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                              <Button
                                variant="outline"
                                size="sm"
                                className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-background/90 backdrop-blur-sm border-0 shadow-lg h-7 w-7 p-0"
                                asChild
                              >
                                <DropdownMenuTrigger>
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </DropdownMenuTrigger>
                              </Button>
                            </DropdownMenu>

                            <Link
                              href={itemLink}
                              className="p-3 space-y-1 bg-gradient-to-b from-card to-card/95"
                            >
                              <h3 className="text-foreground text-sm font-bold truncate">
                                {group.series.name}
                              </h3>
                              {subtitle && (
                                <p className="text-muted-foreground text-xs truncate">
                                  {subtitle}
                                </p>
                              )}
                              {!subtitle && group.series.productionYear && (
                                <p className="text-muted-foreground text-xs">
                                  {group.series.productionYear}
                                </p>
                              )}
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={sentinelRef} className="flex-shrink-0 w-4" />
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Create Watchlist</DialogTitle>
            <DialogDescription>
              {createDialogType === "series"
                ? "Create a new watchlist and add this series to it"
                : `Create a new watchlist and add ${createForItemIds.length} episode${createForItemIds.length > 1 ? "s" : ""} to it`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quick-name">Name</Label>
              <Input
                id="quick-name"
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                placeholder="My Watchlist"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newWatchlistName.trim()) {
                    handleCreateAndAdd();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAndAdd}
              disabled={creating || !newWatchlistName.trim()}
            >
              {creating ? "Creating..." : "Create & Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
