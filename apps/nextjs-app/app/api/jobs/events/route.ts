import { requireSession } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const jobServerUrl =
    process.env.JOB_SERVER_URL && process.env.JOB_SERVER_URL !== "undefined"
      ? process.env.JOB_SERVER_URL
      : "http://localhost:3005";

  const url = new URL(request.url);
  const since = url.searchParams.get("since");

  const upstreamUrl = new URL("/api/events", jobServerUrl);
  if (since) upstreamUrl.searchParams.set("since", since);

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: {
      Accept: "text/event-stream",
    },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
