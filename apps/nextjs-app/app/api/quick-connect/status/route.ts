import { NextResponse } from "next/server";
import { getServerWithSecrets } from "@/lib/db/server";
import { checkQuickConnectStatus } from "@/lib/jellyfin-auth";
import { getInternalUrl } from "@/lib/server-url";

const pollTimestamps = new Map<string, number[]>();
const POLL_RATE_LIMIT = 30;
const POLL_RATE_WINDOW_MS = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of pollTimestamps) {
    const recent = timestamps.filter((t) => now - t < POLL_RATE_WINDOW_MS);
    if (recent.length === 0) pollTimestamps.delete(key);
    else pollTimestamps.set(key, recent);
  }
}, 5 * 60_000).unref();

// Assumes a trusted reverse proxy (e.g. Docker Compose's nginx/traefik) strips
// and sets x-forwarded-for. Without a trusted proxy, clients can spoof this header
// to bypass rate limiting.
function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

function enforcePollRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (pollTimestamps.get(ip) ?? []).filter(
    (t) => now - t < POLL_RATE_WINDOW_MS,
  );
  if (recent.length >= POLL_RATE_LIMIT) return false;
  recent.push(now);
  pollTimestamps.set(ip, recent);
  return true;
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  if (!enforcePollRateLimit(clientIp)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
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
