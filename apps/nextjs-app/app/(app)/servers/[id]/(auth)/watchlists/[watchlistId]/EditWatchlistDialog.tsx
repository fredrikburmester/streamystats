"use client";

import type { Watchlist } from "@streamystats/database";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface EditWatchlistDialogProps {
  watchlist: Watchlist;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditWatchlistDialog({
  watchlist,
  open,
  onOpenChange,
}: EditWatchlistDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(watchlist.name);
  const [description, setDescription] = useState(watchlist.description ?? "");
  const [isPublic, setIsPublic] = useState(watchlist.isPublic);
  const [allowedItemType, setAllowedItemType] = useState(
    watchlist.allowedItemType ?? "",
  );
  const [defaultSortOrder, setDefaultSortOrder] = useState(
    watchlist.defaultSortOrder,
  );

  useEffect(() => {
    if (open) {
      setName(watchlist.name);
      setDescription(watchlist.description ?? "");
      setIsPublic(watchlist.isPublic);
      setAllowedItemType(watchlist.allowedItemType ?? "");
      setDefaultSortOrder(watchlist.defaultSortOrder);
    }
  }, [open, watchlist]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/watchlists/${watchlist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          isPublic,
          allowedItemType: allowedItemType || null,
          defaultSortOrder,
        }),
      });

      if (res.ok) {
        onOpenChange(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Watchlist</DialogTitle>
            <DialogDescription>
              Update your watchlist settings
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Watchlist"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A collection of..."
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-itemType">Item Type Lock</Label>
              <Select
                value={allowedItemType || "_none"}
                onValueChange={(v) =>
                  setAllowedItemType(v === "_none" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Allow all types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Allow all types</SelectItem>
                  <SelectItem value="Movie">Movies only</SelectItem>
                  <SelectItem value="Series">Series only</SelectItem>
                  <SelectItem value="Episode">Episodes only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-sortOrder">Default Sort Order</Label>
              <Select
                value={defaultSortOrder}
                onValueChange={setDefaultSortOrder}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Order</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="dateAdded">Date Added</SelectItem>
                  <SelectItem value="releaseDate">Release Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-public" className="cursor-pointer">
                Make Public
              </Label>
              <Switch
                id="edit-public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
