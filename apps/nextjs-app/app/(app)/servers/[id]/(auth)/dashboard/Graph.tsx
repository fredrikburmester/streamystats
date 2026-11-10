import type { JSX } from "react";
import { getWatchTimePerType } from "@/lib/db/statistics";
import { getMe, getViewerUserId, isUserAdmin } from "@/lib/db/users";
import type { ServerPublic } from "@/lib/types";
import { WatchTimeGraph } from "./WatchTimeGraph";

interface Props {
  server: ServerPublic;
  startDate: string;
  endDate: string;
}

export async function Graph({
  server,
  startDate,
  endDate,
}: Props): Promise<JSX.Element> {
  const [isAdmin, me, viewerUserId] = await Promise.all([
    isUserAdmin(),
    getMe(),
    getViewerUserId(),
  ]);
  const data = await getWatchTimePerType({
    serverId: server.id,
    startDate,
    endDate,
    userId: isAdmin ? undefined : me?.id,
    viewerUserId,
  });

  if (!data) {
    return <p>No data available</p>;
  }

  return <WatchTimeGraph data={data} startDate={startDate} endDate={endDate} />;
}
export default Graph;
