"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

interface CreateWatchlistButtonProps {
  serverId: number;
}

export function CreateWatchlistButton({
  serverId,
}: CreateWatchlistButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [allowedItemType, setAllowedItemType] = useState<string>("");
  const [defaultSortOrder, setDefaultSortOrder] = useState("custom");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          isPublic,
          allowedItemType: allowedItemType || undefined,
          defaultSortOrder,
        }),
      });

      if (res.ok) {
        const { data } = await res.json();
        setOpen(false);
        setName("");
        setDescription("");
        setIsPublic(false);
        setAllowedItemType("");
        setDefaultSortOrder("custom");
        router.refresh();
        router.push(`/servers/${serverId}/watchlists/${data.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Watchlist
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Watchlist</DialogTitle>
            <DialogDescription>
              Create a new watchlist to organize your media
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Watchlist"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A collection of..."
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="itemType">Item Type Lock (optional)</Label>
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
              <Label htmlFor="sortOrder">Default Sort Order</Label>
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
              <Label htmlFor="public" className="cursor-pointer">
                Make Public
              </Label>
              <Switch
                id="public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
