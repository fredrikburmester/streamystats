import type { User } from "@streamystats/database/schema";
import { getTotalWatchTimeForUsers, getUsers } from "@/lib/db/users";
import type { ServerPublic } from "@/lib/types";
import { UserLeaderboardTable } from "./UserLeaderBoardTable";

interface Props {
  server: ServerPublic;
}

export const UserLeaderboard = async ({ server }: Props) => {
  const users = await getUsers({ serverId: server.id });
  const totalWatchTime = await getTotalWatchTimeForUsers({
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
