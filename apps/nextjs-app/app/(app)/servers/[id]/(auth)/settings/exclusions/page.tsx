import { redirect } from "next/navigation";
import { Container } from "@/components/Container";
import { getLibraries } from "@/lib/db/libraries";
import { getServer } from "@/lib/db/server";
import { getUsers, isUserAdmin } from "@/lib/db/users";
import { ExcludedLibrariesManager } from "./ExcludedLibrariesManager";
import { ExcludedUsersManager } from "./ExcludedUsersManager";

export default async function ExclusionsSettings(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const server = await getServer({ serverId: id });
  if (!server) {
    redirect("/setup");
  }

  const isAdmin = await isUserAdmin();
  if (!isAdmin) {
    redirect(`/servers/${id}/dashboard`);
  }

  const [users, libraries] = await Promise.all([
    getUsers({ serverId: server.id }),
    // Skip statistics exclusion filters so excluded libraries remain manageable
    getLibraries({ serverId: server.id, includeStatisticsExcluded: true }),
  ]);

  return (
    <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
      <h1 className="text-3xl font-bold mb-2">Statistics Exclusions</h1>
      <p className="text-muted-foreground mb-8">
        Hide specific users or libraries from all statistics and leaderboards.
        Data is still collected - only the display is affected.
      </p>

      <div className="space-y-8">
        <ExcludedUsersManager
          serverId={server.id}
          users={users}
          excludedUserIds={server.excludedUserIds || []}
        />
        <ExcludedLibrariesManager
          serverId={server.id}
          libraries={libraries}
          excludedLibraryIds={server.excludedLibraryIds || []}
        />
      </div>
    </Container>
  );
}
