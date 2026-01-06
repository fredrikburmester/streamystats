"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getUserInferWatchtimePreference,
  resetUserInferWatchtimePreference,
  setUserInferWatchtimePreference,
} from "@/lib/db/mark-watched";
import { getMe } from "@/lib/db/users";

interface InferWatchtimeSettingProps {
  serverId: number;
}

type PreferenceValue = "ask" | "yes" | "no";

export function InferWatchtimeSetting({
  serverId,
}: InferWatchtimeSettingProps) {
  const [preference, setPreference] = useState<PreferenceValue>("ask");
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadPreference() {
      try {
        const me = await getMe();
        if (!me) return;

        setUserId(me.id);
        const pref = await getUserInferWatchtimePreference(me.id, serverId);

        if (pref === null) {
          setPreference("ask");
        } else if (pref === true) {
          setPreference("yes");
        } else {
          setPreference("no");
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadPreference();
  }, [serverId]);

  const handleChange = async (value: PreferenceValue) => {
    if (!userId) return;

    setIsSaving(true);
    try {
      if (value === "ask") {
        const result = await resetUserInferWatchtimePreference(
          userId,
          serverId,
        );
        if (result.success) {
          setPreference("ask");
          toast.success("Preference reset. You will be asked next time.");
        } else {
          toast.error("Failed to reset preference");
        }
      } else {
        const result = await setUserInferWatchtimePreference(
          userId,
          serverId,
          value === "yes",
        );
        if (result.success) {
          setPreference(value);
          toast.success("Preference saved");
        } else {
          toast.error("Failed to save preference");
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Infer Watchtime</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Infer Watchtime</CardTitle>
        <CardDescription>
          When you mark an item as watched, should we automatically record it as
          watch time in your statistics?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="infer-watchtime">Behavior</Label>
          <Select
            value={preference}
            onValueChange={handleChange}
            disabled={isSaving}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ask">Ask me each time</SelectItem>
              <SelectItem value="yes">Always infer watchtime</SelectItem>
              <SelectItem value="no">Never infer watchtime</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {preference === "ask" &&
            "You will be prompted each time you mark an item as watched or unwatched."}
          {preference === "yes" &&
            "Watch time will be automatically recorded when you mark items as watched."}
          {preference === "no" &&
            "Items will be marked as watched without recording watch time."}
        </p>
      </CardContent>
    </Card>
  );
}
