import { CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";
import type React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getMe,
  getViewerUserId,
  getWatchTimePeriodTotals,
  isUserAdmin,
} from "@/lib/db/users";
import type { ServerPublic } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface Props {
  server: ServerPublic;
}

const WatchTimePeriodTotals: React.FC<Props> = async ({ server }) => {
  const [me, isAdmin, viewerUserId] = await Promise.all([
    getMe(),
    isUserAdmin(),
    getViewerUserId(),
  ]);

  if (!me) {
    redirect("/not-found");
  }

  const totals = await getWatchTimePeriodTotals({
    serverId: server.id,
    userId: isAdmin ? undefined : me.id,
    viewerUserId,
  });

  const periods = [
    { label: "All Time", value: totals.total },
    { label: "This Year", value: totals.year },
    { label: "This Month", value: totals.month },
    { label: "This Week", value: totals.week },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {periods.map((period) => (
        <Card key={period.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm font-medium">
              <p className="text-neutral-500">{period.label}</p>
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatDuration(period.value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default WatchTimePeriodTotals;
