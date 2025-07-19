"use server";

import { Container } from "@/components/Container";
import { getServer } from "@/lib/db/server";
import { redirect } from "next/navigation";
import DatabaseBackupRestore from "./DatabaseBackupRestore";
import JellystatsImport from "./JellystatsImport";
import LegacyImport from "./LegacyImport";
import PlaybackReportingImport from "./PlaybackReportingImport";

export default async function BackupAndImportSettings(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const server = await getServer(id);

  if (!server) {
    redirect("/not-found");
  }

  return (
    <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
      <h1 className="text-3xl font-bold mb-8">Backup & Import Settings</h1>

      <div className="space-y-8">
        <div>
          <JellystatsImport serverId={server.id} />
        </div>

        <div>
          <PlaybackReportingImport serverId={server.id} />
        </div>

        <div>
          <LegacyImport serverId={server.id} />
        </div>

        <hr className="my-8" />

        <div>
          <DatabaseBackupRestore serverId={server.id} />
        </div>
      </div>
    </Container>
  );
}
