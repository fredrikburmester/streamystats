import type { Server } from "@streamystats/database/schema";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getServers, getServerWithSecrets } from "@/lib/db/server";
import { checkQuickConnectEnabled } from "@/lib/jellyfin-auth";
import { getInternalUrl } from "@/lib/server-url";
import type { ServerPublic } from "@/lib/types";
import { SignInForm } from "./SignInForm";

function toPublic(s: Server): ServerPublic {
  const { apiKey, embeddingApiKey, chatApiKey, ...rest } = s;
  return {
    ...rest,
    hasEmbeddingApiKey: Boolean(embeddingApiKey),
    hasChatApiKey: Boolean(chatApiKey),
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent params={params} />
    </Suspense>
  );
}

async function LoginContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [serverWithSecrets, servers] = await Promise.all([
    getServerWithSecrets({ serverId: id }),
    getServers(),
  ]);

  if (!serverWithSecrets) {
    redirect("/not-found");
  }

  const quickConnectEnabled = await checkQuickConnectEnabled({
    serverUrl: getInternalUrl(serverWithSecrets),
  });

  return (
    <SignInForm
      server={toPublic(serverWithSecrets)}
      servers={servers}
      quickConnectEnabled={quickConnectEnabled}
      disablePasswordLogin={serverWithSecrets.disablePasswordLogin}
    />
  );
}

function LoginSkeleton() {
  return (
    <div className="flex h-screen w-full items-center justify-center px-4">
      <div className="mx-auto lg:min-w-[400px] space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}
