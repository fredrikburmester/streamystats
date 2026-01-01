import { redirect } from "next/navigation";
import { Container } from "@/components/Container";
import { getInferredSessionCount } from "@/lib/db/infer-watchtime";
import { getServer } from "@/lib/db/server";
import { getUsers, isUserAdmin } from "@/lib/db/users";
import { CleanupManager } from "../CleanupManager";
import { DangerousMergeManager } from "../DangerousMergeManager";
import { DangerousSeriesMergeManager } from "../DangerousSeriesMergeManager";
import { DeleteServer } from "../DeleteServer";
import { InferWatchtimeAdminManager } from "../InferWatchtimeAdminManager";
import { MergeItemsManager } from "../MergeItemsManager";
import { UpdateConnection } from "../UpdateConnection";
import { VersionSection } from "../VersionSection";

export default async function GeneralSettings(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const server = await getServer({ serverId: id });
  if (!server) {
    redirect("/setup");
  }

  const [isAdmin, users, totalInferredSessions] = await Promise.all([
    isUserAdmin(),
    getUsers({ serverId: server.id }),
    getInferredSessionCount(server.id),
  ]);

  return (
    <Container className="flex flex-col">
      <h1 className="text-3xl font-bold mb-8">General Settings</h1>

      <div className="space-y-8">
        <VersionSection />
        <UpdateConnection
          serverId={server.id}
          url={server.url}
          internalUrl={server.internalUrl}
        />
        {isAdmin ? (
          <InferWatchtimeAdminManager
            serverId={server.id}
            users={users.map((u) => ({ id: u.id, name: u.name }))}
            totalInferredSessions={totalInferredSessions}
          />
        ) : null}
        {isAdmin ? <CleanupManager serverId={server.id} /> : null}
        {isAdmin ? <MergeItemsManager server={server} /> : null}
        {isAdmin ? <DangerousMergeManager server={server} /> : null}
        {isAdmin ? <DangerousSeriesMergeManager server={server} /> : null}
        <DeleteServer server={server} />
      </div>
    </Container>
  );
}
