import { NextResponse } from "next/server";
import { getServer } from "@/lib/db/server";
import { checkQuickConnectStatus } from "@/lib/jellyfin-auth";
import { createRateLimiter, getClientIpFromRequest } from "@/lib/rate-limit";
import { getInternalUrl } from "@/lib/server-url";

const pollLimiter = createRateLimiter({
  limit: 30,
  windowMs: 60_000,
  message: "Too many requests. Please try again later.",
});

export async function POST(request: Request) {
  const clientIp = getClientIpFromRequest(request);
  if (!pollLimiter.check("poll", clientIp)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: { serverId?: string; secret?: string };
  try {
    body = (await request.json()) as { serverId?: string; secret?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const serverId = body.serverId;
  const secret = body.secret;

  if (
    !serverId ||
    !secret ||
    !/^\d+$/.test(serverId) ||
    !/^[0-9a-f]{64}$/i.test(secret)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const server = await getServer({ serverId });
  if (!server) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await checkQuickConnectStatus({
    serverUrl: getInternalUrl(server),
    secret,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ authenticated: result.authenticated });
}
