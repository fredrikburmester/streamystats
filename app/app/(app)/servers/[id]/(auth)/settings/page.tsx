"use server";

import { Container } from "@/components/Container";
import { getServer, getUser } from "@/lib/db";
import { getLibrariesDirectlyFromJellyfin } from "@/lib/jellyfin";
import { getMe } from "@/lib/me";
import { redirect } from "next/navigation";
import { DeleteServer } from "./DeleteServer";
import JellystatsImport from "./JellystatsImport";
import LibrarySettings from "./LibrarySettings";
import { Tasks } from "./Tasks";

export default async function Settings({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const server = await getServer(id);

  const me = await getMe();
  const user = await getUser(me?.name, server?.id);

  if (!server) {
    redirect("/setup");
  }

  const jellyfinLibraries = await getLibrariesDirectlyFromJellyfin(server);

  // const users = await getUsers(server.id);
  // const libraries = await getLibraries(server.id);

  return (
    <Container className="">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      {user?.is_administrator ? (
        <>
          <Tasks server={server} />
          <LibrarySettings server={server} libraries={jellyfinLibraries} />
          <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">Jellystat import</h2>

            <JellystatsImport serverId={server.id} />
          </div>
          {/* <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">
              Tautulli Integration
            </h2>
            <p className="mb-4">
              Map your Tautulli libraries and users to Jellyfin to import watch
              statistics and other data.
            </p>
            <TautulliMappingModal
              tautulliLibraries={tautulliData.libraries}
              tautulliUsers={tautulliData.users}
              jellyfinLibraries={libraries}
              jellyfinUsers={users}
              serverId={server.id}
            />
          </div> */}
        </>
      ) : (
        <p>You are not an administrator of this server.</p>
      )}
      <DeleteServer server={server} />
    </Container>
  );
}
