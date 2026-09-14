import type { User } from "@streamystats/database/schema";
import {
  getAnalyticsUsers,
  getTotalWatchTimeForUsers,
  getViewerUserId,
} from "@/lib/db/users";
import type { ServerPublic } from "@/lib/types";
import { UserLeaderboardTable } from "./UserLeaderBoardTable";

interface Props {
  server: ServerPublic;
}

export const UserLeaderboard = async ({ server }: Props) => {
  const users = await getAnalyticsUsers({ serverId: server.id });
  const totalWatchTime = await getTotalWatchTimeForUsers({
    serverId: server.id,
    viewerUserId: await getViewerUserId(),
    userIds: users.map((user: User) => user.id),
  });

  return (
    <UserLeaderboardTable
      users={users}
      server={server}
      totalWatchTime={totalWatchTime}
    />
  );
};
