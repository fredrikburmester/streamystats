import { expect, mock } from "bun:test";

let role = "admin";
let mutations = 0;
let invalidated = false;
mock.module("@/lib/api-auth", () => ({
  requireAdmin: async (serverId: number) => {
    const status =
      role === "anonymous" ? 401 : role !== "admin" || serverId !== 1 ? 403 : 0;
    return status
      ? { error: Response.json({}, { status }), session: null }
      : {
          error: null,
          session: { id: "admin", name: "Admin", serverId: 1, isAdmin: true },
        };
  },
}));
class UserMergeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
mock.module("@streamystats/database", () => ({
  UserMergeError,
  getMergeAccounts: async () => [
    { id: "old", name: "Old" },
    { id: "new", name: "New" },
    { id: "admin", name: "Admin" },
  ],
  previewUserMerge: async () => ({
    source: { id: "old", name: "Old" },
    target: { id: "new", name: "New" },
    token: "a".repeat(64),
    transferred: { sessions: 2 },
    watchTime: 50,
  }),
  mergeUsersPermanently: async (args: {
    actor: { id: string };
    input: { sourceUserId: string };
  }) => {
    expect(args.actor.id).toBe("admin");
    if (args.input.sourceUserId === "changed")
      throw new UserMergeError("Accounts changed", 409);
    mutations++;
    return { targetUserId: "new", transferred: { sessions: 2 } };
  },
}));
mock.module("next/cache", () => ({
  revalidatePath() {},
  revalidateTag: (tag: string, options: { expire: number }) => {
    invalidated = tag === "user-analytics" && options.expire === 0;
  },
}));
const { handleUserMerge } = await import("../user-merge-api");
const input = { sourceUserId: "old", targetUserId: "new" };
let body: unknown = {
  input,
  previewToken: "a".repeat(64),
  operationId: crypto.randomUUID(),
  confirmation: "MERGE",
};
async function call({
  method = "POST",
  serverId = "1",
  preview = false,
  origin = "http://192.168.1.10:3000",
  csrfToken = "",
  site = "same-origin",
  url = "http://192.168.1.10:3000/api/servers/1/user-merge",
} = {}) {
  return handleUserMerge({
    serverId,
    preview,
    request: new Request(url, {
      method,
      headers: {
        origin,
        "sec-fetch-site": site,
        "x-user-merge-csrf": csrfToken,
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    }),
  });
}
role = "anonymous";
expect((await call()).status).toBe(401);
role = "user";
expect((await call()).status).toBe(403);
role = "admin";
expect((await call({ serverId: "2" })).status).toBe(403);
expect((await call({ serverId: "1e0" })).status).toBe(400);
expect((await call({ origin: "https://attacker.invalid" })).status).toBe(403);
const overview = await (await call({ method: "GET" })).json();
expect(
  overview.accounts.find((a: { id: string }) => a.id === "admin").canRetire,
).toBe(false);
body = { ...input, sourceUserId: "admin" };
expect((await call({ preview: true })).status).toBe(400);
body = input;
const previewResponse = await call({ preview: true });
expect(previewResponse.status).toBe(200);
const preview = await previewResponse.json();
expect(preview.operationId).toMatch(/^[a-f0-9-]{36}$/);
body = { input, previewToken: preview.token, operationId: preview.operationId };
expect((await call()).status).toBe(400);
body = {
  input,
  previewToken: preview.token,
  operationId: preview.operationId,
  confirmation: "MERGE",
  actorId: "forged",
};
expect((await call()).status).toBe(400);
expect(mutations).toBe(0);
body = {
  input,
  previewToken: preview.token,
  operationId: preview.operationId,
  confirmation: "MERGE",
};
expect((await call()).status).toBe(200);
expect(mutations).toBe(1);
expect(invalidated).toBe(true);
// A reverse proxy can use the server/admin-bound token; cross-site requests cannot.
const proxy = {
  url: "http://nextjs:3000/api/servers/1/user-merge",
  origin: "https://stats.example.com",
};
expect((await call(proxy)).status).toBe(403);
expect(
  (await call({ ...proxy, csrfToken: overview.csrfToken, site: "cross-site" }))
    .status,
).toBe(403);
expect((await call({ ...proxy, csrfToken: overview.csrfToken })).status).toBe(
  200,
);
body = {
  input: { ...input, sourceUserId: "changed" },
  previewToken: preview.token,
  operationId: preview.operationId,
  confirmation: "MERGE",
};
expect((await call()).status).toBe(409);
