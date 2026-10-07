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
import { updateExcludeStartedAction } from "./recommendation-actions";

interface RecommendationSettingsManagerProps {
  serverId: number;
  excludeStarted: boolean;
}

export function RecommendationSettingsManager({
  serverId,
  excludeStarted: initialExcludeStarted,
}: RecommendationSettingsManagerProps) {
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
      </CardContent>
    </Card>
  );
}
