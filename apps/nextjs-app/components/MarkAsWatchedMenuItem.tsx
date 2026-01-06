"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  deleteInferredSessionForItem,
  getUserInferWatchtimePreference,
  markItemWatched,
  setUserInferWatchtimePreference,
} from "@/lib/db/mark-watched";

interface MarkAsWatchedMenuItemProps {
  itemId: string;
  serverId: number;
  userId: string;
  isPlayed?: boolean;
  onStatusChange?: (isPlayed: boolean) => void;
}

export function MarkAsWatchedMenuItem({
  itemId,
  serverId,
  userId,
  isPlayed: initialIsPlayed = false,
  onStatusChange,
}: MarkAsWatchedMenuItemProps) {
  const [isPlayed, setIsPlayed] = useState(initialIsPlayed);
  const [isLoading, setIsLoading] = useState(false);
  const [showInferDialog, setShowInferDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [inferPreference, setInferPreference] = useState<boolean | null>(null);

  useEffect(() => {
    getUserInferWatchtimePreference(userId, serverId).then(setInferPreference);
  }, [userId, serverId]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;

    if (!isPlayed) {
      // Marking as watched
      if (inferPreference === null) {
        setShowInferDialog(true);
        return;
      }
      await performMarkWatched(inferPreference);
    } else {
      // Marking as unwatched
      if (inferPreference === null) {
        setShowRemoveDialog(true);
        return;
      }
      await performMarkUnwatched(inferPreference);
    }
  };

  const performMarkWatched = async (inferWatchtime: boolean) => {
    setIsLoading(true);
    try {
      const result = await markItemWatched(
        serverId,
        itemId,
        true,
        inferWatchtime,
      );
      if (result.success) {
        setIsPlayed(true);
        onStatusChange?.(true);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const performMarkUnwatched = async (removeInferred: boolean) => {
    setIsLoading(true);
    try {
      const result = await markItemWatched(serverId, itemId, false, false);
      if (result.success) {
        if (removeInferred) {
          const deleted = await deleteInferredSessionForItem(
            serverId,
            userId,
            itemId,
          );
          if (deleted > 0) {
            toast.success(
              `Marked as unwatched and removed ${deleted} inferred session(s)`,
            );
          } else {
            toast.success("Marked as unwatched");
          }
        } else {
          toast.success(result.message);
        }
        setIsPlayed(false);
        onStatusChange?.(false);
      } else {
        toast.error(result.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInferDialogResponse = async (
    shouldInfer: boolean,
    remember: boolean,
  ) => {
    if (remember) {
      await setUserInferWatchtimePreference(userId, serverId, shouldInfer);
      setInferPreference(shouldInfer);
    }
    setShowInferDialog(false);
    await performMarkWatched(shouldInfer);
  };

  const handleRemoveDialogResponse = async (
    shouldRemove: boolean,
    remember: boolean,
  ) => {
    if (remember) {
      await setUserInferWatchtimePreference(userId, serverId, shouldRemove);
      setInferPreference(shouldRemove);
    }
    setShowRemoveDialog(false);
    await performMarkUnwatched(shouldRemove);
  };

  return (
    <>
      <DropdownMenuItem onClick={handleClick} disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : isPlayed ? (
          <Check className="w-4 h-4 mr-2" />
        ) : (
          <Circle className="w-4 h-4 mr-2" />
        )}
        {isPlayed ? "Mark as Unwatched" : "Mark as Watched"}
      </DropdownMenuItem>

      {/* Dialog for marking as watched */}
      <AlertDialog open={showInferDialog} onOpenChange={setShowInferDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Infer Watchtime?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to record this as watch time in your statistics?
              This creates a session entry as if you watched the entire item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={() => handleInferDialogResponse(false, false)}
            >
              No
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleInferDialogResponse(true, false)}
            >
              Yes
            </Button>
            <AlertDialogAction
              onClick={() => handleInferDialogResponse(true, true)}
            >
              Yes and remember
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog for marking as unwatched */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Inferred Watchtime?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to also remove any inferred watch time for this
              item from your statistics?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={() => handleRemoveDialogResponse(false, false)}
            >
              No
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleRemoveDialogResponse(true, false)}
            >
              Yes
            </Button>
            <AlertDialogAction
              onClick={() => handleRemoveDialogResponse(true, true)}
            >
              Yes and remember
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
