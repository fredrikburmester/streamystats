import { mock } from "bun:test";
import assert from "node:assert/strict";
import * as schema from "@streamystats/database/schema";
import { NextRequest } from "next/server";

// What the fake Jellyfin answers per path; a path left out fails to connect.
// It only listens on the internal URL: the public one can't be reached from
// where Streamystats runs. A request that doesn't carry the token gets 401.
let jellyfin: Record<string, () => Response> = {};
let merged = false;
const token = "test-only";

mock.module("server-only", () => ({}));
mock.module("../session", () => ({ getSession: async () => null }));
mock.module("@streamystats/database", () => ({
  ...schema,
  getMergedUserTarget: async () => (merged ? "destination" : null),
  db: {
    select: () => ({
      from: async () => [
        {
          id: 1,
          name: "Jellyfin",
          url: "http://public.invalid",
          internalUrl: "http://jellyfin.invalid",
        },
      ],
    }),
    query: { users: { findFirst: async () => undefined } },
  },
}));
globalThis.fetch = mock(
  async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const answer = url.host === "jellyfin.invalid" && jellyfin[url.pathname];
    if (!answer) throw new TypeError("fetch failed");
    const sent = new Headers(init?.headers).get("authorization") ?? "";
    if (!sent.includes(`Token="${token}"`))
      return new Response(null, { status: 401 });
    return answer();
  },
);
// The key check logs every refusal; stderr is kept for real failures.
console.warn = () => {};
console.error = () => {};

// Load the real guards after installing boundary mocks.
const { authenticateMediaBrowserForServer, requireApiKey } = await import(
  "../api-auth"
);
const { db, servers } = await import("@streamystats/database");
const [server] = await db.select().from(servers);
assert.ok(server);

const tokenRequest = new NextRequest("http://localhost/api/recommendations", {
  headers: { Authorization: `MediaBrowser Token="${token}"` },
});
const keyRequest = new NextRequest("http://localhost/api/deleted-items", {
  headers: { Authorization: `Bearer ${token}` },
});
const forServer = () =>
  authenticateMediaBrowserForServer({ request: tokenRequest, server });
const keyStatus = async () =>
  (await requireApiKey({ request: keyRequest, server }))?.status ?? 200;
const status = (code: number) => () => new Response(null, { status: code });
const systemInfo = () => Response.json({ Id: "jellyfin-server" });
const userMe = (isAdministrator: boolean) => () =>
  Response.json({
    Id: "user-a",
    Name: "User A",
    Policy: { IsAdministrator: isAdministrator },
  });
const apiKeys =
  (...accessTokens: string[]) =>
  () =>
    Response.json({
      Items: accessTokens.map((AccessToken) => ({ AccessToken })),
    });

// A regular user: Jellyfin answers /System/Info but not /Auth/Keys. Their
// token is theirs on the token routes and no key to everyone's data.
jellyfin = {
  "/Users/Me": userMe(false),
  "/System/Info": systemInfo,
  "/Auth/Keys": status(403),
};
assert.deepEqual(await forServer(), {
  id: "user-a",
  name: "User A",
  serverId: 1,
  isAdmin: false,
});
assert.equal(await keyStatus(), 401);

// An account that was merged away no longer signs in.
merged = true;
assert.equal(await forServer(), null);
merged = false;

// An administrator's token.
jellyfin = {
  "/Users/Me": userMe(true),
  "/System/Info": systemInfo,
  "/Auth/Keys": apiKeys("another-key"),
};
assert.equal((await forServer())?.isAdmin, true);
assert.equal(await keyStatus(), 200);

// A server API key has no user, so /Users/Me answers 400.
jellyfin = {
  "/Users/Me": status(400),
  "/System/Info": systemInfo,
  "/Auth/Keys": apiKeys("another-key", token),
};
assert.deepEqual(await forServer(), {
  id: "system-api-key",
  name: "System API Key",
  serverId: 1,
  isAdmin: true,
});
assert.equal(await keyStatus(), 200);

// A token Jellyfin doesn't know.
jellyfin = {
  "/Users/Me": status(401),
  "/System/Info": status(401),
  "/Auth/Keys": status(401),
};
assert.equal(await forServer(), null);
assert.equal(await keyStatus(), 401);

// Jellyfin can't be reached.
jellyfin = {};
assert.equal(await forServer(), null);
assert.equal(await keyStatus(), 401);

// No key or token at all.
const bare = new NextRequest("http://localhost/api/deleted-items");
assert.equal(
  await authenticateMediaBrowserForServer({ request: bare, server }),
  null,
);
assert.equal((await requireApiKey({ request: bare, server }))?.status, 401);
