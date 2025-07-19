"use client";

import JellyfinAvatar from "@/components/JellyfinAvatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePersistantState } from "@/hooks/usePersistantState";
import { formatDuration } from "@/lib/utils";
import { Server, User } from "@streamystats/database";
import { Clock, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { UserLeaderboardFilter } from "./UserLeaderBoardFilter";

interface Props {
  users: User[];
  server: Server;
  totalWatchTime: { [key: string]: number };
}

export const UserLeaderboardTable = ({
  users,
  server,
  totalWatchTime,
}: Props) => {
  const [hiddenUsers, setHiddenUsers, loading] = usePersistantState<string[]>(
    "hiddenUsers",
    []
  );

  const sortedUsers = useMemo(() => {
    if (loading) {
      return [];
    }
    return users
      .filter((user) => !hiddenUsers.includes(user.id))
      .filter((user) => (totalWatchTime[user.id] ?? 0) > 0)
      .sort((a, b) => (totalWatchTime[b.id] ?? 0) - (totalWatchTime[a.id] ?? 0))
      .slice(0, 10);
  }, [users, hiddenUsers, loading]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center">
          <CardTitle className="text-2xl font-bold mr-auto">
            User Leaderboard
          </CardTitle>
          <UserLeaderboardFilter
            key="user-leaderboard-filter"
            users={users}
            hiddenUsers={hiddenUsers}
            setHiddenUsers={setHiddenUsers}
          />
          <Trophy className="h-5 w-5 text-yellow-500 ml-4" />
        </div>
        <p className="text-sm text-muted-foreground">
          Showing the top {sortedUsers.length} users with the most watch time
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow key="header-row">
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Watch Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.length > 0 ? (
              sortedUsers.map((user, index) => (
                <TableRow
                  key={`${index}-${user.id}`}
                  className="transition-colors duration-200 hover:bg-accent/60 group"
                >
                  <TableCell className="font-medium">
                    {index === 0 ? (
                      <span className="text-yellow-500 font-bold">🥇 1</span>
                    ) : index === 1 ? (
                      <span className="text-gray-400 font-bold">🥈 2</span>
                    ) : index === 2 ? (
                      <span className="text-amber-700 font-bold">🥉 3</span>
                    ) : (
                      <span className="text-gray-500">{index + 1}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/servers/${server.id}/users/${user.id}`}
                      className="flex items-center gap-2 group"
                    >
                      <JellyfinAvatar
                        user={user}
                        serverUrl={server.url}
                        className="h-6 w-6 transition-transform duration-200 group-hover:scale-110"
                      />
                      <span className="transition-colors duration-200 group-hover:text-primary">
                        {user.name}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDuration(totalWatchTime[user.id] ?? 0)}</span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow key="empty-row">
                <TableCell
                  colSpan={3}
                  className="text-center py-6 text-muted-foreground"
                >
                  No watch data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
