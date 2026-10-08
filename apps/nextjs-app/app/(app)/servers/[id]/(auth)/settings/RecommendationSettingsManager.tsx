"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  updateExcludeStartedAction,
  updateRecommendationCollectionsAction,
} from "./recommendation-actions";

interface RecommendationSettingsManagerProps {
  serverId: number;
  excludeStarted: boolean;
  collectionsEnabled: boolean;
}

export function RecommendationSettingsManager({
  serverId,
  excludeStarted: initialExcludeStarted,
  collectionsEnabled: initialCollectionsEnabled,
}: RecommendationSettingsManagerProps) {
  const [collectionsEnabled, setCollectionsEnabled] = useState(
    initialCollectionsEnabled,
  );
  const [excludeStarted, setExcludeStarted] = useState(initialExcludeStarted);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (checked: boolean) => {
    setExcludeStarted(checked);
    startTransition(async () => {
      const result = await updateExcludeStartedAction(serverId, checked);
      if (result.success) {
        toast.success(
          checked
            ? "Only never-started titles will be recommended"
            : "Partly watched titles can be recommended again",
        );
      } else {
        setExcludeStarted(!checked);
        toast.error(result.message || "Failed to update settings");
      }
    });
  };

  const handleCollectionsToggle = (checked: boolean) => {
    setCollectionsEnabled(checked);
    startTransition(async () => {
      const result = await updateRecommendationCollectionsAction(
        serverId,
        checked,
      );
      if (result.success) {
        toast.success(result.message);
      } else {
        setCollectionsEnabled(!checked);
        toast.error(result.message || "Failed to update settings");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Recommendations
        </CardTitle>
        <CardDescription>
          How AI recommendations and the chat assistant decide what counts as
          new
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="exclude-started">
              Don't recommend anything already started
            </Label>
            <p className="text-sm text-muted-foreground">
              Skip any movie or series a user has played at all, including a few
              minutes of a movie, a single episode, or another copy of the same
              title. When off, only titles watched past halfway (or two or more
              episodes of a series) are skipped.
            </p>
          </div>
          <Switch
            id="exclude-started"
            checked={excludeStarted}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
        </div>
        <div className="flex items-center justify-between gap-4 mt-6">
          <div className="space-y-1">
            <Label htmlFor="recommendation-collections">
              Create recommendation collections in Jellyfin
            </Label>
            <p className="text-sm text-muted-foreground">
              Keeps a personal "AI Recommendations" collection in
              Jellyfin for every user, refreshed hourly. Each collection is
              hidden from everyone else with{" "}
              <code>.hide-from-&lt;user&gt;</code> tags, and each user's
              parental control gets their own <code>.hide-from-</code> tag added
              to its blocked tags. Turning this off removes the collections and
              those tags.
            </p>
          </div>
          <Switch
            id="recommendation-collections"
            checked={collectionsEnabled}
            onCheckedChange={handleCollectionsToggle}
            disabled={isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}
