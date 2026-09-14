import { ArrowRightLeft, Calendar, Trophy } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSimilarUsers, type SimilarUser } from "@/lib/db/user-similarity";

function UserList({
  users,
  emptyMessage,
}: {
  users: SimilarUser[];
  emptyMessage: string;
}) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-sm">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {users.map(({ user, similarity, commonItems, similarPairs }, index) => (
        <div
          key={user.id}
          className="flex flex-col gap-2 group rounded-lg p-2 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-8 w-8 border border-white/10">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow ring-1 ring-background">
                  {index + 1}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
                  {user.name}
                </span>
              </div>
            </div>
            <div className="text-xs font-mono text-muted-foreground bg-white/5 px-2 py-1 rounded">
              {Math.round(similarity * 100)}%
            </div>
          </div>

          {commonItems.length > 0 && (
            <div className="pl-11 text-xs text-muted-foreground">
              <span className="font-medium text-white/40">
                Shared favorites:{" "}
              </span>
              {commonItems
                .slice(0, 3)
                .map((i) => i.name)
                .join(", ")}
              {commonItems.length > 3 && `, +${commonItems.length - 3} more`}
            </div>
          )}

          {commonItems.length === 0 && similarPairs.length > 0 && (
            <div className="pl-11 flex flex-col gap-1">
              <span className="text-xs font-medium text-white/40 mb-0.5">
                Similar tastes:
              </span>
              {similarPairs.map((pair, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80"
                >
                  <span className="truncate max-w-[100px] text-muted-foreground">
                    {pair.itemA.name}
                  </span>
                  <ArrowRightLeft className="w-3 h-3 text-white/20 flex-shrink-0" />
                  <span className="truncate max-w-[100px] text-muted-foreground">
                    {pair.itemB.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export async function UserSimilarity({
  serverId,
  userId,
}: {
  serverId: string | number;
  userId: string;
}) {
  const { overall, thisMonth } = await getSimilarUsers(serverId, userId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="w-full bg-background/40 backdrop-blur-md border-white/10 shadow-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/5">
          <CardTitle className="text-md font-bold flex items-center gap-2 bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            <Trophy className="w-5 h-5 text-primary" />
            Most Similar (All Time)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <UserList
            users={overall}
            emptyMessage="No similar users found based on watch history."
          />
        </CardContent>
      </Card>

      <Card className="w-full bg-background/40 backdrop-blur-md border-white/10 shadow-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/5">
          <CardTitle className="text-md font-bold flex items-center gap-2 bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            <Calendar className="w-5 h-5 text-primary" />
            Most Similar (This Month)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <UserList
            users={thisMonth}
            emptyMessage="Not enough data for this month."
          />
        </CardContent>
      </Card>
    </div>
  );
}
