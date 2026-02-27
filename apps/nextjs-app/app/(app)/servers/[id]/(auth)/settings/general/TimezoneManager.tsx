"use client";

import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIMEZONE_OPTIONS } from "@/lib/timezone-data";
import { updateServerTimezoneAction } from "../actions";

interface TimezoneManagerProps {
  serverId: number;
  currentTimezone: string;
}

export function TimezoneManager({
  serverId,
  currentTimezone,
}: TimezoneManagerProps) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(currentTimezone);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (timezone === currentTimezone) return;

    setLoading(true);
    try {
      const result = await updateServerTimezoneAction(serverId, timezone);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Failed to update timezone");
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = timezone !== currentTimezone;
  const currentLabel =
    TIMEZONE_OPTIONS.find((tz) => tz.value === currentTimezone)?.label ??
    currentTimezone;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Display Timezone
        </CardTitle>
        <CardDescription>
          Set the timezone used to display dates and times for this server. All
          data is stored in UTC.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={!hasChanges || loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Current: {currentLabel}
          {hasChanges && " (unsaved changes)"}
        </p>
      </CardContent>
    </Card>
  );
}
