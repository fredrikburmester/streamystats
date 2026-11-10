"use client";

import type { Library } from "@streamystats/database/schema";
import { FolderX, Loader, Settings2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { updateExcludedLibrariesAction } from "./actions";

interface ExcludedLibrariesManagerProps {
  serverId: number;
  libraries: Library[];
  excludedLibraryIds: string[];
}

export function ExcludedLibrariesManager({
  serverId,
  libraries,
  excludedLibraryIds: initialExcluded,
}: ExcludedLibrariesManagerProps) {
  const [open, setOpen] = useState(false);
  const [excludedLibraryIds, setExcludedLibraryIds] =
    useState<string[]>(initialExcluded);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (libraryId: string, visible: boolean) => {
    const newExcluded = visible
      ? excludedLibraryIds.filter((id) => id !== libraryId)
      : [...excludedLibraryIds, libraryId];

    setExcludedLibraryIds(newExcluded);

    startTransition(async () => {
      const result = await updateExcludedLibrariesAction(serverId, newExcluded);
      if (result.success) {
        toast.success(
          visible ? "Library now visible" : "Library hidden from stats",
        );
      } else {
        setExcludedLibraryIds(
          visible
            ? [...excludedLibraryIds, libraryId]
            : excludedLibraryIds.filter((id) => id !== libraryId),
        );
        toast.error(result.message || "Failed to update settings");
      }
    });
  };

  const excludedIdSet = new Set(excludedLibraryIds);
  let excludedCount = 0;
  for (const library of libraries) {
    if (excludedIdSet.has(library.id)) {
      excludedCount += 1;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderX className="h-5 w-5" />
          Excluded Libraries
        </CardTitle>
        <CardDescription>
          Items from excluded libraries will be hidden from all statistics,
          including watch time, item lists, and recommendations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Manage Libraries ({excludedCount} hidden)
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderX className="h-5 w-5" />
                Exclude Libraries from Statistics
              </DialogTitle>
              <DialogDescription>
                Toggle visibility for each library. Hidden libraries and their
                items will not appear in any statistics. Changes are saved
                automatically.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-1">
                {libraries.map((library) => {
                  const isVisible = !excludedLibraryIds.includes(library.id);

                  return (
                    <div
                      key={library.id}
                      className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{library.name}</span>
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            {library.type}
                          </span>
                          {isPending && (
                            <Loader className="h-3 w-3 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {isVisible ? "Visible in stats" : "Hidden from stats"}
                        </p>
                      </div>
                      <Switch
                        checked={isVisible}
                        onCheckedChange={(checked) =>
                          handleToggle(library.id, checked)
                        }
                        disabled={isPending}
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="text-xs text-muted-foreground pt-2 border-t">
              {libraries.length - excludedCount} of {libraries.length} libraries
              visible
            </div>
          </DialogContent>
        </Dialog>

        <p className="text-sm text-muted-foreground mt-3">
          Hidden libraries&apos; content is still synced but excluded from all
          statistics views.
        </p>
      </CardContent>
    </Card>
  );
}
