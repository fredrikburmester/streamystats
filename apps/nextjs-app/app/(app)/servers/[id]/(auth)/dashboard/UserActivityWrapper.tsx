import type * as React from "react";
import { getUserActivityPerDay, getViewerUserId } from "@/lib/db/users";
import type { ServerPublic } from "@/lib/types";
import { UserActivityChart } from "./UserActivityChart";

interface Props {
  server: ServerPublic;
  startDate: string;
  endDate: string;
}

export const UserActivityWrapper: React.FC<Props> = async ({
  server,
  startDate,
  endDate,
}) => {
  const viewerUserId = await getViewerUserId();
  const data = await getUserActivityPerDay({
    serverId: server.id,
    startDate,
    endDate,
    viewerUserId,
  });

  return (
    <UserActivityChart data={data} startDate={startDate} endDate={endDate} />
  );
};
