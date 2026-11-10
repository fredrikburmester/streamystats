import { mock } from "bun:test";
import assert from "node:assert/strict";
import * as schema from "@streamystats/database/schema";
import { NextRequest } from "next/server";

// What the fake Jellyfin answers per path; a path left out fails to connect.
let jellyfin: Record<string, () => Response> = {};
const requested: string[] = [];

mock.module("server-only", () => ({}));
mock.module("../session", () => ({ getSession: async () => null }));
mock.module("@streamystats/database", () => ({
  ...schema,
  getMergedUserTarget: async () => null,
  db: {
    select: () => ({
      from: async () => [{ id: 1, url: "http://jellyfin.invalid" }],
    }),
    query: { users: { findFirst: async () => undefined } },
  },
}));
globalThis.fetch = mock(async (input: string | URL | Request) => {
  const path = new URL(String(input)).pathname;
  requested.push(path);
  const answer = jellyfin[path];
  if (!answer) throw new TypeError("fetch failed");
  return answer();
});

// Load the real guards after installing boundary mocks.
const { requireAuth, validateJellyfinToken } = await import("../api-auth");
const token = "test-only";
const tokenRequest = new NextRequest("http://localhost/api/watchlists", {
  headers: { Authorization: `MediaBrowser Token="${token}"` },
});
const validate = () => validateJellyfinToken("http://jellyfin.invalid", token);
const status = (code: number) => () => new Response(null, { status: code });
const systemInfo = () => Response.json({ Id: "jellyfin-server" });
const apiKeys =
  (...accessTokens: string[]) =>
  () =>
    Response.json({
      Items: accessTokens.map((AccessToken) => ({ AccessToken })),
    });

// A user outside their parental access schedule: Jellyfin refuses them on
// /Users/Me while /System/Info still answers.
jellyfin = {
  "/Users/Me": status(403),
  "/System/Info": systemInfo,
  "/Auth/Keys": status(403),
};
assert.equal(await validate(), null);
assert.equal((await requireAuth(tokenRequest, 1)).error?.status, 401);

// An administrator's own token when /Users/Me breaks: /Auth/Keys answers an
// administrator, but the token is not one of the keys.
jellyfin = {
  "/Users/Me": status(500),
  "/System/Info": systemInfo,
  "/Auth/Keys": apiKeys("another-key"),
};
assert.equal(await validate(), null);
assert.equal((await requireAuth(tokenRequest, 1)).error?.status, 401);

// /Users/Me can't be reached at all.
jellyfin = { "/System/Info": systemInfo, "/Auth/Keys": status(403) };
assert.equal(await validate(), null);
assert.equal((await requireAuth(tokenRequest, 1)).error?.status, 401);

// A server API key has no user, so /Users/Me answers 400.
jellyfin = {
  "/Users/Me": status(400),
  "/System/Info": systemInfo,
  "/Auth/Keys": apiKeys("another-key", token),
};
assert.deepEqual(await validate(), {
  userId: "system-api-key",
  userName: "System API Key",
  isAdmin: true,
});
const apiKeyAuth = await requireAuth(tokenRequest, 1);
assert.equal(apiKeyAuth.error, null);
assert.equal(apiKeyAuth.session?.id, "system-api-key");
assert.equal(apiKeyAuth.session?.isAdmin, true);

// A working user token never reaches the API key check.
requested.length = 0;
jellyfin = {
  "/Users/Me": () =>
    Response.json({
      Id: "user-a",
      Name: "User A",
      Policy: { IsAdministrator: false },
    }),
  "/System/Info": systemInfo,
  "/Auth/Keys": apiKeys(token),
};
assert.deepEqual(await validate(), {
  userId: "user-a",
  userName: "User A",
  isAdmin: false,
});
assert.deepEqual(requested, ["/Users/Me"]);
