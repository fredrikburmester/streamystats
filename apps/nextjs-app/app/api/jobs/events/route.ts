import { requireSession } from "@/lib/api-auth";
import { jobServer } from "@/lib/job-server";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const since = url.searchParams.get("since");

  const upstream = await jobServer.openEventStream(since);

  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { error: `Upstream error: ${upstream.status}` },
      { status: 502 },
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
