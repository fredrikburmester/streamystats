"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type EditableRecommendationProfile,
  getRecommendationProfileForEdit,
  saveRecommendationProfile,
} from "@/lib/db/recommendation-profile-actions";

interface RecommendationProfileSettingProps {
  serverId: number;
  /** Edit this user's profile instead of the signed-in user's (admins only). */
  userId?: string;
  userName?: string;
}

export function RecommendationProfileSetting({
  serverId,
  userId,
  userName,
}: RecommendationProfileSettingProps) {
  const [profile, setProfile] = useState<EditableRecommendationProfile | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const other = userId !== undefined && userName !== undefined;

  useEffect(() => {
    getRecommendationProfileForEdit(serverId, userId).then(setProfile);
  }, [serverId, userId]);

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const update = (patch: Partial<EditableRecommendationProfile>) =>
    setProfile({ ...profile, ...patch });

  const save = () => {
    startTransition(async () => {
      const result = await saveRecommendationProfile(serverId, profile, userId);
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Recommendations</CardTitle>
        <CardDescription>
          Steer what gets recommended to {other ? userName : "you"}. Separate
          themes with commas or new lines; each one is matched on its own.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="taste-likes">{other ? "Into" : "I'm into"}</Label>
          <Textarea
            id="taste-likes"
            placeholder="e.g. heist thrillers, nature documentaries, space exploration"
            value={profile.likesText}
            onChange={(e) => update({ likesText: e.target.value })}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taste-dislikes">Not for me</Label>
          <Textarea
            id="taste-dislikes"
            placeholder="e.g. horror, reality TV"
            value={profile.dislikesText}
            onChange={(e) => update({ dislikesText: e.target.value })}
            rows={2}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="taste-history">
              {other ? "Use their watch history" : "Use my watch history"}
            </Label>
            <p className="text-sm text-muted-foreground">
              Off: watch history no longer steers recommendations (useful for
              shared viewing). Ratings and the themes above still do, and
              watched titles are still never recommended.
            </p>
          </div>
          <Switch
            id="taste-history"
            checked={profile.useWatchHistory}
            onCheckedChange={(checked) => update({ useWatchHistory: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="taste-started">
              {other
                ? "Don't recommend anything they've started"
                : "Don't recommend anything I've started"}
            </Label>
            <p className="text-sm text-muted-foreground">
              Skip any movie or series played at all, including a few minutes of
              a movie, a single episode, or another copy of the same title. Off:
              only titles watched past halfway are skipped.
            </p>
          </div>
          <Switch
            id="taste-started"
            checked={profile.excludeStarted}
            onCheckedChange={(checked) => update({ excludeStarted: checked })}
          />
        </div>
        <Button onClick={save} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
