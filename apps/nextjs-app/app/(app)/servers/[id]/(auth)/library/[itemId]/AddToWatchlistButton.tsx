"use client";

import { Check, ListPlus, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WatchlistInfo {
  id: number;
  name: string;
  itemCount: number;
  allowedItemType: string | null;
}

interface AddToWatchlistButtonProps {
  itemId: string;
  itemType: string;
  serverId: number;
}

export function AddToWatchlistButton({
  itemId,
  itemType,
  serverId,
}: AddToWatchlistButtonProps) {
  const router = useRouter();
  const [watchlists, setWatchlists] = useState<WatchlistInfo[]>([]);
  const [inWatchlists, setInWatchlists] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchWatchlists();
  }, []);

  const fetchWatchlists = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlists");
      if (res.ok) {
        const { data } = await res.json();
        setWatchlists(data);

        // Check which watchlists contain this item
        const containingLists: number[] = [];
        for (const wl of data) {
          const itemRes = await fetch(`/api/watchlists/${wl.id}/items`);
          if (itemRes.ok) {
            const { data: wlData } = await itemRes.json();
            if (wlData.items.some((i: any) => i.item.id === itemId)) {
              containingLists.push(wl.id);
            }
          }
        }
        setInWatchlists(containingLists);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWatchlist = async (watchlistId: number) => {
    if (inWatchlists.includes(watchlistId)) {
      // Remove from watchlist
      setAdding(watchlistId);
      try {
        const res = await fetch(
          `/api/watchlists/${watchlistId}/items/${itemId}`,
          {
            method: "DELETE",
          },
        );
        if (res.ok) {
          setInWatchlists(inWatchlists.filter((id) => id !== watchlistId));
        }
      } finally {
        setAdding(null);
      }
    } else {
      // Add to watchlist
      setAdding(watchlistId);
      try {
        const res = await fetch(`/api/watchlists/${watchlistId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId }),
        });
        if (res.ok) {
          setInWatchlists([...inWatchlists, watchlistId]);
        }
      } finally {
        setAdding(null);
      }
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newWatchlistName.trim()) return;

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

        // Add item to the new watchlist
        await fetch(`/api/watchlists/${newWatchlist.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId }),
        });

        setWatchlists([...watchlists, newWatchlist]);
        setInWatchlists([...inWatchlists, newWatchlist.id]);
        setShowCreateDialog(false);
        setNewWatchlistName("");
      }
    } finally {
      setCreating(false);
    }
  };

  // Filter watchlists that can accept this item type
  const compatibleWatchlists = watchlists.filter(
    (wl) => !wl.allowedItemType || wl.allowedItemType === itemType,
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2" disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ListPlus className="w-4 h-4" />
            )}
            Add to Watchlist
            {inWatchlists.length > 0 && (
              <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5">
                {inWatchlists.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {compatibleWatchlists.length === 0 ? (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
              No compatible watchlists
            </div>
          ) : (
            compatibleWatchlists.map((wl) => (
              <DropdownMenuItem
                key={wl.id}
                onClick={() => handleAddToWatchlist(wl.id)}
                disabled={adding === wl.id}
                className="flex items-center justify-between"
              >
                <span className="truncate">{wl.name}</span>
                {adding === wl.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : inWatchlists.includes(wl.id) ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : null}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create new watchlist
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
