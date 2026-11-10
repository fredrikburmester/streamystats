import { redirect } from "next/navigation";
import { Container } from "@/components/Container";
import { getServer } from "@/lib/db/server";
import { ReconnectForm } from "./ReconnectForm";

export default async function ReconnectPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await props.params;
  const { from } = await props.searchParams;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/setup");
  }

  const showUnreachableAlert = from !== "settings";

  return (
    <Container className="flex flex-col items-center justify-center min-h-screen w-screen">
      <div className="w-full max-w-2xl">
        <ReconnectForm
          serverId={server.id}
          serverName={server.name}
          currentUrl={server.url}
          currentInternalUrl={server.internalUrl}
          showUnreachableAlert={showUnreachableAlert}
        />
      </div>
    </Container>
  );
}
