"use server";

import { Container } from "@/components/Container";
import { getServer } from "@/lib/db/server";
import { redirect } from "next/navigation";
import { JellyseerrManager } from "../JellyseerrManager";

export default async function JellyseerrSettings(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const server = await getServer({ serverId: id });
  if (!server) {
    redirect("/setup");
  }

  return (
    <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
      <h1 className="text-3xl font-bold mb-8">Jellyseerr Settings</h1>

      <div className="space-y-8">
        <JellyseerrManager server={server} />
      </div>
    </Container>
  );
}
