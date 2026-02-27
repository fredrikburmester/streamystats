"use client";

import {
  Check,
  Clock,
  ExternalLink,
  Film,
  ListPlus,
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
import { getRecentlyAddedItems } from "@/lib/db/recently-added";
import type { RecentlyAddedItem } from "@/lib/db/recently-added-types";
import type { ServerPublic } from "@/lib/types";

interface WatchlistInfo {
  id: number;
  name: string;
  itemCount: number;
  allowedItemType: string | null;
}

interface RecentlyAddedProps {
  items: RecentlyAddedItem[];
  server: ServerPublic;
  itemType: "Movie" | "Series";
  userId: string;
}

const themeConfig = {
  Movie: {
    gradient: "from-amber-500/10 via-orange-500/5 to-amber-500/10",
    radial: "from-amber-500/20",
    iconBg: "text-amber-500",
    headerBadge: "bg-amber-500/20 text-amber-400",
    itemBadge: "bg-amber-600/90 text-white",
    icon: Film,
    title: "Recently Added Movies",
    description: "Latest movies added to your library",
  },
  Series: {
    gradient: "from-purple-500/10 via-fuchsia-500/5 to-purple-500/10",
    radial: "from-purple-500/20",
    iconBg: "text-purple-500",
    headerBadge: "bg-purple-500/20 text-purple-400",
    itemBadge: "bg-purple-600/90 text-white",
    icon: Tv,
    title: "Recently Added Series",
    description: "Latest series added to your library",
  },
};

export function RecentlyAdded({
  items: initialItems,
  server,
  itemType,
  userId,
}: RecentlyAddedProps) {
  const [items, setItems] = useState(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const theme = themeConfig[itemType];
  const Icon = theme.icon;

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
  const [createForItemType, setCreateForItemType] = useState<string | null>(
    null,
  );
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [creating, setCreating] = useState(false);

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

  const fetchItemWatchlists = async (itemId: string) => {
    if (itemWatchlists[itemId]) return;
    try {
      const containingLists: number[] = [];
      for (const wl of watchlists) {
        const itemRes = await fetch(`/api/watchlists/${wl.id}/items`);
        if (itemRes.ok) {
          const { data: wlData } = await itemRes.json();
          if (
            wlData.items.some(
              (i: { item: { id: string } }) => i.item.id === itemId,
            )
          ) {
            containingLists.push(wl.id);
          }
        }
      }
      setItemWatchlists((prev) => ({ ...prev, [itemId]: containingLists }));
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

  const handleCreateAndAdd = async () => {
    if (!newWatchlistName.trim() || !createForItemId) return;

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

        await fetch(`/api/watchlists/${newWatchlist.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: createForItemId }),
        });

        setWatchlists((prev) => [...prev, newWatchlist]);
        setItemWatchlists((prev) => ({
          ...prev,
          [createForItemId]: [
            ...(prev[createForItemId] || []),
            newWatchlist.id,
          ],
        }));
        toast.success("Created watchlist and added item");
        setShowCreateDialog(false);
        setNewWatchlistName("");
        setCreateForItemId(null);
        setCreateForItemType(null);
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

  const getCompatibleWatchlists = (itemTypeFilter: string) => {
    return watchlists.filter(
      (wl) => !wl.allowedItemType || wl.allowedItemType === itemTypeFilter,
    );
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
          getRecentlyAddedItems(server.id, itemType, 20, items.length)
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
  }, [server.id, itemType, items.length, isLoading, hasMore]);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <>
      <div>
        <div
          className={`rounded-lg border bg-gradient-to-r ${theme.gradient} relative overflow-hidden`}
        >
          <div
            className={`absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] ${theme.radial} via-transparent to-transparent opacity-50`}
          />
          <div className="relative z-10">
            <div className="p-4 pb-3">
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <div
                  className={`p-1.5 rounded-lg bg-background/50 ${theme.iconBg}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span>{theme.title}</span>
                <Badge
                  variant="outline"
                  className={`ml-2 text-[10px] ${theme.headerBadge} border-0`}
                >
                  New
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <Sparkles className="h-3 w-3" />
                {theme.description}
              </p>
            </div>

            <div className="">
              <ScrollArea dir="ltr" className="w-full py-1">
                <div className="flex gap-4 flex-nowrap px-4 w-max">
                  {items.map((item) => {
                    const inWatchlists = itemWatchlists[item.id] || [];
                    const compatibleWatchlists = getCompatibleWatchlists(
                      item.type,
                    );

                    return (
                      <div
                        key={item.id}
                        className="flex-shrink-0 group relative"
                      >
                        <div className="relative w-[152px] sm:w-[184px] py-2">
                          <div className="flex flex-col overflow-hidden border border-border bg-card rounded-lg hover:border-primary/50 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:z-10 relative">
                            <Link
                              href={`/servers/${server.id}/library/${item.id}`}
                            >
                              <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                                <Poster
                                  item={item}
                                  server={server}
                                  width={184}
                                  height={240}
                                  preferredImageType="Primary"
                                  className="w-full h-[208px] sm:h-[256px] rounded-t-lg"
                                />
                                <div className="absolute top-2 left-2 z-20">
                                  <Badge
                                    className={`${theme.itemBadge} backdrop-blur-md border-0 shadow-lg text-xs font-medium px-1.5 py-0.5`}
                                  >
                                    <Clock className="h-2.5 w-2.5 mr-1" />
                                    New
                                  </Badge>
                                </div>
                              </div>
                            </Link>

                            <DropdownMenu
                              onOpenChange={(open) => {
                                if (open) {
                                  fetchWatchlists();
                                  if (watchlists.length > 0) {
                                    fetchItemWatchlists(item.id);
                                  }
                                }
                              }}
                            >
                              <DropdownMenuContent align="end" className="w-48">
                                <MarkAsWatchedMenuItem
                                  itemId={item.id}
                                  serverId={server.id}
                                  userId={userId}
                                />
                                <DropdownMenuSeparator />
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>
                                    <ListPlus className="h-4 w-4 mr-2" />
                                    Add to Watchlist
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="w-48">
                                    {watchlistsLoading ? (
                                      <div className="flex items-center justify-center py-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      </div>
                                    ) : compatibleWatchlists.length === 0 ? (
                                      <div className="px-2 py-2 text-sm text-muted-foreground text-center">
                                        No compatible watchlists
                                      </div>
                                    ) : (
                                      compatibleWatchlists.map((wl) => (
                                        <DropdownMenuItem
                                          key={wl.id}
                                          onClick={() =>
                                            handleAddToWatchlist(item.id, wl.id)
                                          }
                                          disabled={
                                            addingToWatchlist ===
                                            `${item.id}-${wl.id}`
                                          }
                                          className="flex items-center justify-between"
                                        >
                                          <span className="truncate">
                                            {wl.name}
                                          </span>
                                          {addingToWatchlist ===
                                          `${item.id}-${wl.id}` ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : inWatchlists.includes(wl.id) ? (
                                            <Check className="h-4 w-4 text-primary" />
                                          ) : null}
                                        </DropdownMenuItem>
                                      ))
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setCreateForItemId(item.id);
                                        setCreateForItemType(item.type);
                                        setShowCreateDialog(true);
                                      }}
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Create new watchlist
                                    </DropdownMenuItem>
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuItem
                                  onClick={() => openInJellyfin(item.id)}
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
                              href={`/servers/${server.id}/library/${item.id}`}
                              className="p-3 space-y-2 bg-gradient-to-b from-card to-card/95"
                            >
                              <div>
                                <h3 className="text-foreground text-sm font-bold truncate">
                                  {item.name}
                                </h3>
                                <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1.5">
                                  {item.productionYear}
                                  {item.runtimeTicks &&
                                    formatRuntime(item.runtimeTicks) && (
                                      <>
                                        <span>•</span>
                                        {formatRuntime(item.runtimeTicks)}
                                      </>
                                    )}
                                </p>
                              </div>
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
              Create a new watchlist and add this item to it
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
