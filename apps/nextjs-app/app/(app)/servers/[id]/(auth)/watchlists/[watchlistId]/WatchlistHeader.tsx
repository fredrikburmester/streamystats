"use client";

import {
  ArrowLeft,
  Globe,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WatchlistWithItemsLite } from "@/lib/db/watchlists";
import { EditWatchlistDialog } from "./EditWatchlistDialog";

interface WatchlistHeaderProps {
  watchlist: WatchlistWithItemsLite;
  isOwner: boolean;
}

export function WatchlistHeader({ watchlist, isOwner }: WatchlistHeaderProps) {
  const router = useRouter();
  const params = useParams();
  const serverIdParam = params.id as string;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/watchlists/${watchlist.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push(`/servers/${serverIdParam}/watchlists`);
        router.refresh();
      }
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <div className="mb-6">
        <Link
          href={`/servers/${serverIdParam}/watchlists`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Watchlists
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{watchlist.name}</h1>
              {watchlist.isPublic ? (
                <Globe className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Lock className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            {watchlist.description && (
              <p className="text-muted-foreground mb-3">
                {watchlist.description}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {watchlist.items.length}{" "}
                {watchlist.items.length === 1 ? "item" : "items"}
              </Badge>
              {watchlist.allowedItemType && (
                <Badge variant="outline">
                  {watchlist.allowedItemType} only
                </Badge>
              )}
              <Badge variant="outline" className="capitalize">
                Sort: {watchlist.defaultSortOrder}
              </Badge>
            </div>
          </div>
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Watchlist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{watchlist.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditWatchlistDialog
        watchlist={watchlist}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
    </>
  );
}
