import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  getMergeAccounts,
  mergeUsersPermanently,
  previewUserMerge,
  UserMergeError,
} from "@streamystats/database";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./api-auth";

const inputSchema = z
  .object({
    sourceUserId: z.string().min(1).max(256),
    targetUserId: z.string().min(1).max(256),
  })
  .strict();
const commitSchema = z
  .object({
    input: inputSchema,
    previewToken: z.string().regex(/^[a-f0-9]{64}$/),
    operationId: z.string().uuid(),
    confirmation: z.literal("MERGE"),
  })
  .strict();

// A token bound to the admin and server lets the browser submit through a proxy
// whose public origin differs from Next's internal URL. Forwarded headers do
// not grant an origin exemption. Only an authenticated GET can obtain a token.
function csrfToken({
  serverId,
  actorId,
  hour = Math.floor(Date.now() / 3_600_000),
}: {
  serverId: number;
  actorId: string;
  hour?: number;
}): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production")
    throw new Error("SESSION_SECRET is required");
  const signature = createHmac(
    "sha256",
    secret ?? "user-merge-local-development",
  )
    .update(JSON.stringify(["user-merge-csrf", serverId, actorId, hour]))
    .digest("hex");
  return `${hour}.${signature}`;
}

function hasCsrfToken({
  request,
  serverId,
  actorId,
}: {
  request: Request;
  serverId: number;
  actorId: string;
}): boolean {
  const token = request.headers.get("x-user-merge-csrf");
  if (!token || !/^\d+\.[a-f0-9]{64}$/.test(token)) return false;
  if (
    ["cross-site", "same-site"].includes(
      request.headers.get("sec-fetch-site") ?? "",
    )
  )
    return false;
  const hour = Number(token.split(".")[0]);
  const age = Math.floor(Date.now() / 3_600_000) - hour;
  if (!Number.isSafeInteger(hour) || age < 0 || age > 1) return false;
  const expected = Buffer.from(csrfToken({ serverId, actorId, hour }));
  const supplied = Buffer.from(token);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    return (
      source.origin === target.origin &&
      ["same-origin", "none", null].includes(
        request.headers.get("sec-fetch-site"),
      )
    );
  } catch {
    return false;
  }
}

export async function handleUserMerge({
  request,
  serverId: rawServerId,
  preview = false,
}: {
  request: Request;
  serverId: string;
  preview?: boolean;
}) {
  if (
    !/^\d+$/.test(rawServerId) ||
    !Number.isSafeInteger(Number(rawServerId)) ||
    Number(rawServerId) < 1
  )
    return Response.json({ error: "Invalid server ID." }, { status: 400 });
  const serverId = Number(rawServerId);
  const auth = await requireAdmin(serverId);
  if (auth.error) return auth.error;
  if (
    request.method !== "GET" &&
    !hasSameOrigin(request) &&
    !hasCsrfToken({ request, serverId, actorId: auth.session.id })
  )
    return Response.json(
      { error: "Same-origin request required." },
      { status: 403 },
    );
  try {
    if (request.method === "GET")
      return Response.json(
        {
          accounts: (await getMergeAccounts({ serverId })).map((account) => ({
            ...account,
            canRetire: account.id !== auth.session.id,
          })),
          csrfToken: csrfToken({ serverId, actorId: auth.session.id }),
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    if (preview) {
      const input = inputSchema.parse(await request.json());
      if (input.sourceUserId === auth.session.id)
        throw new UserMergeError(
          "Sign in with a different administrator before retiring this account.",
        );
      return Response.json({
        ...(await previewUserMerge({ serverId, input })),
        operationId: randomUUID(),
      });
    }
    const { confirmation: _, ...input } = commitSchema.parse(
      await request.json(),
    );
    const result = await mergeUsersPermanently({
      serverId,
      ...input,
      actor: auth.session,
    });
    revalidateTag("user-analytics", { expire: 0 });
    revalidatePath(`/servers/${serverId}`, "layout");
    return Response.json(result);
  } catch (error) {
    if (error instanceof UserMergeError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return Response.json(
        { error: "Invalid permanent merge request." },
        { status: 400 },
      );
    return Response.json(
      { error: "Merge failed. Retry the same request." },
      { status: 500 },
    );
  }
}
