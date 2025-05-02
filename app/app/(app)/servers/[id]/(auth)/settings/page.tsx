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
import { OpenAIAPI } from "./OpenAIAPI";

export default async function Settings({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const server = await getServer(id);

  if (!server) {
    redirect("/setup");
  }

  return (
    <Container className="">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <Tasks server={server} />
      <OpenAIAPI
        serverId={server.id}
        initialApiKey={server.open_ai_api_token}
      />
      <Accordion type="single" collapsible className="mb-4">
        <AccordionItem value="jellystat-import">
          <AccordionTrigger className="text-2xl font-semibold">
            Jellystat Import
          </AccordionTrigger>
          <AccordionContent>
            <JellystatsImport serverId={server.id} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="playback-reporting-import">
          <AccordionTrigger className="text-2xl font-semibold">
            Playback Reporting Plugin Import
          </AccordionTrigger>
          <AccordionContent>
            <PlaybackReportingImport serverId={server.id} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="database-backup">
          <AccordionTrigger className="text-2xl font-semibold">
            Database Backup & Restore
          </AccordionTrigger>
          <AccordionContent>
            <DatabaseBackupRestore serverId={server.id} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <VersionSection />
      <DeleteServer server={server} />
    </Container>
  );
}
