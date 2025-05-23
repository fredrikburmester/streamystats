"use server";

import { Container } from "@/components/Container";
import { getServer } from "@/lib/db";
import { redirect } from "next/navigation";
import { DeleteServer } from "./DeleteServer";
import JellystatsImport from "./JellystatsImport";
import { Tasks } from "./Tasks";
import { VersionSection } from "./VersionSection";
import PlaybackReportingImport from "./PlaybackReportingImport";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import DatabaseBackupRestore from "./DatabaseBackupRestore";
import { EmbeddingsManager } from "./EmbeddingsManager";
import { UrlConfiguration } from "./UrlConfiguration";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function Settings({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: { section?: string };
}) {
  const { id } = await params;
  const server = await getServer(id);
  if (!server) {
    redirect("/setup");
  }

  const section = searchParams.section || "general";

  return (
    <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {section === "general" && (
        <div className="space-y-8">
          <UrlConfiguration server={server} />
          <VersionSection />
          <DeleteServer server={server} />
        </div>
      )}

      {section === "sync" && (
        <div className="space-y-8">
          <Tasks server={server} />
        </div>
      )}

      {section === "ai" && (
        <div className="space-y-8">
          <EmbeddingsManager server={server} />
        </div>
      )}

      {section === "backup" && (
        <div className="space-y-8">
          <div>
            <DatabaseBackupRestore serverId={server.id} />
          </div>

          <div>
            <JellystatsImport serverId={server.id} />
          </div>

          <div>
            <PlaybackReportingImport serverId={server.id} />
          </div>
        </div>
      )}
    </Container>
  );
}
