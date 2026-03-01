import { NextResponse } from "next/server";
import { getServerWithSecrets } from "@/lib/db/server";
import { checkQuickConnectStatus } from "@/lib/jellyfin-auth";
import { getInternalUrl } from "@/lib/server-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get("serverId");
  const secret = searchParams.get("secret");

  if (!serverId || !secret || !/^\d+$/.test(serverId)) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 },
    );
  }

  const server = await getServerWithSecrets({ serverId });
  if (!server) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await checkQuickConnectStatus({
    serverUrl: getInternalUrl(server),
    secret,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 502 },
    );
  }

  return NextResponse.json({ authenticated: result.authenticated });
}
