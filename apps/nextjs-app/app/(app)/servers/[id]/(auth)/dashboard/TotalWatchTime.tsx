import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMe, getTotalWatchTime } from "@/lib/db/users";
import { formatDuration } from "@/lib/utils";
import { showAdminStatistics } from "@/utils/adminTools";
import { Server } from "@streamystats/database";
import { Clock } from "lucide-react";
import { redirect } from "next/navigation";
import React from "react";

interface Props {
  server: Server;
}

const TotalWatchTime: React.FC<Props> = async ({ server }) => {
  const me = await getMe();
  const sas = await showAdminStatistics();

  if (!me) {
    redirect("/not-found");
  }

  const d1 = await getTotalWatchTime(server.id, sas ? undefined : me.id);

  return (
    <Card className="flex-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
        <CardTitle className="text-sm font-medium">
          <p className="text-neutral-500">Total Watch Time</p>
        </CardTitle>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-start">
          <p className="text-3xl font-bold">{formatDuration(d1)}</p>
          <p className="text-sm text-muted-foreground">
            Total time spent watching
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TotalWatchTime;
