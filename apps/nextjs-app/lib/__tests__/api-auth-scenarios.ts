import { mock } from "bun:test";
import assert from "node:assert/strict";
import * as schema from "@streamystats/database/schema";
import { NextRequest } from "next/server";
import type { SessionUser } from "../session";

const admin: SessionUser = {
  id: "admin-a",
  name: "Admin A",
  serverId: 1,
  isAdmin: true,
};
let session: SessionUser | null = admin;
const queriedServers: number[] = [];

mock.module("server-only", () => ({}));
mock.module("../session", () => ({ getSession: async () => session }));
mock.module("@streamystats/database", () => ({
  ...schema,
  db: {
    select: () => ({
      from: async () => [{ id: 1, url: "http://jellyfin.invalid" }],
    }),
    query: { users: { findFirst: async () => undefined } },
  },
}));
mock.module("../db/libraries", () => ({
  getLibraries: async ({ serverId }: { serverId: number }) => {
    queriedServers.push(serverId);
    return [];
  },
}));
globalThis.fetch = mock(async () =>
  Response.json({
    Id: admin.id,
    Name: admin.name,
    Policy: { IsAdministrator: true },
  }),
);

// Load the real guards and route after installing boundary mocks.
const { requireSession, requireAdmin, requireAuth } = await import(
  "../api-auth"
);
const { GET } = await import("../../app/api/libraries/route");
const request = new NextRequest("http://localhost/api/libraries");
const tokenRequest = new NextRequest(request.url, {
  headers: { Authorization: 'MediaBrowser Token="test-only"' },
});
const invalidIds = [
  "2junk",
  "1junk",
  "1e0",
  "0x1",
  "1.0",
  "",
  " ",
  "1\n",
  "NaN",
  "Infinity",
  "9007199254740993",
  0,
  -1,
  1.5,
  NaN,
  Infinity,
  Number.MAX_SAFE_INTEGER + 1,
  null,
  true,
  [1],
  {},
];
const guards = [
  requireSession,
  requireAdmin,
  (id?: number | string) => requireAuth(request, id),
];

for (const guard of guards) {
  for (const id of [undefined, 1, "1", "01"]) {
    assert.equal((await guard(id)).error, null);
  }
  for (const id of [2, "2", ...invalidIds]) {
    const result = await Reflect.apply(guard, undefined, [id]);
    assert.equal(result.error?.status, 403, `Guard accepted ${String(id)}`);
    assert.equal(result.session, null);
  }
}

for (const id of ["2", "2junk", "1e0", "0x1"]) {
  const response = await GET(new Request(`${request.url}?serverId=${id}`));
  assert.equal(response.status, 403);
}
assert.deepEqual(queriedServers, []);
assert.equal((await GET(new Request(`${request.url}?serverId=1`))).status, 200);
assert.deepEqual(queriedServers, [1]);

session = { ...admin, isAdmin: false };
assert.equal((await requireAdmin(1)).error?.status, 403);
session = null;
assert.equal((await requireSession(1)).error?.status, 401);
assert.equal((await requireAuth(request, 1)).error?.status, 401);
assert.equal((await requireAuth(tokenRequest, 1)).error, null);
for (const id of [2, "2", ...invalidIds]) {
  const result = await Reflect.apply(requireAuth, undefined, [
    tokenRequest,
    id,
  ]);
  assert.equal(result.error?.status, 403, `Token guard accepted ${String(id)}`);
  assert.equal(result.session, null);
}
