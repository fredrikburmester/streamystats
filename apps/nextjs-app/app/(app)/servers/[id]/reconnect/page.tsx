"use server";

import { Container } from "@/components/Container";
import { getServer } from "@/lib/db/server";
import { redirect } from "next/navigation";
import { ReconnectForm } from "./ReconnectForm";

export default async function ReconnectPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/setup");
  }

  return (
    <Container className="flex flex-col items-center justify-center min-h-screen w-screen">
      <div className="w-full max-w-2xl">
        <ReconnectForm
          serverId={server.id}
          serverName={server.name}
          currentUrl={server.url}
        />
      </div>
    </Container>
  );
}

