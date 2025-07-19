"use server";

import { Container } from "@/components/Container";
import { getServer } from "@/lib/db/server";
import { redirect } from "next/navigation";
import { DeleteServer } from "../DeleteServer";
import { VersionSection } from "../VersionSection";
import { SystemStatsDisplay } from "@/components/SystemStatsDisplay";

export default async function GeneralSettings(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const server = await getServer(id);
  if (!server) {
    redirect("/setup");
  }

  return (
    <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
      <h1 className="text-3xl font-bold mb-8">General Settings</h1>

      <div className="space-y-8">
        <VersionSection />
        <SystemStatsDisplay />
        <DeleteServer server={server} />
      </div>
    </Container>
  );
}
