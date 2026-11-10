import { redirect } from "next/navigation";
import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { getServer } from "@/lib/db/server";
import { getMe } from "@/lib/db/users";
import { getWatchlistsForUser } from "@/lib/db/watchlists";
import { CreateWatchlistButton } from "./CreateWatchlistButton";
import { WatchlistsTable } from "./WatchlistsTable";

export default async function WatchlistsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const server = await getServer({ serverId: id });
  const me = await getMe();

  if (!server) {
    redirect("/not-found");
  }

  if (!me) {
    redirect(`/servers/${id}/login`);
  }

  const watchlists = await getWatchlistsForUser({
    serverId: server.id,
    userId: me.id,
  });

  return (
    <Container>
      <div className="flex items-center justify-between mb-6">
        <PageTitle
          title="Watchlists"
          subtitle="Create and manage your personal watchlists"
        />
        <CreateWatchlistButton serverId={server.id} />
      </div>
      <WatchlistsTable
        watchlists={watchlists}
        serverId={server.id}
        server={{ url: server.url, internalUrl: server.internalUrl }}
        currentUserId={me.id}
      />
    </Container>
  );
}
