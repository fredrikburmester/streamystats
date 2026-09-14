import { expect } from "bun:test";
import { handleUserGroups } from "../user-group-api";
import { state } from "./user-group-api-preload";

const change = {
  groupId: null,
  primaryUserId: "new",
  memberUserIds: ["old", "new"],
  expectedRevision: null,
};
const input = {
  change,
  previewToken: "a".repeat(64),
  operationId: crypto.randomUUID(),
};
async function call({
  serverId = "1",
  origin = "https://fixture.invalid",
  body = JSON.stringify(input),
  method = "POST",
  preview = false,
} = {}) {
  const request = new Request(
    `https://fixture.invalid/api/servers/${serverId}/user-groups`,
    {
      method,
      headers: { origin, "Content-Type": "application/json" },
      ...(method === "GET" ? {} : { body }),
    },
  );
  return handleUserGroups({ request, serverId, preview });
}
state.role = "anonymous";
expect((await call()).status).toBe(401);
state.role = "user";
expect((await call()).status).toBe(403);
state.role = "admin";
expect((await call({ serverId: "2" })).status).toBe(403);
expect(state.scopedServer).toBe(2);
expect((await call({ serverId: "1e0" })).status).toBe(400);
expect((await call({ origin: "https://attacker.invalid" })).status).toBe(403);
expect((await call({ origin: "" })).status).toBe(403);
expect((await call({ body: "not json" })).status).toBe(400);
expect(
  (await call({ body: JSON.stringify({ ...input, actorId: "forged" }) }))
    .status,
).toBe(400);
expect(
  (
    await call({
      body: JSON.stringify({
        ...input,
        change: { ...change, memberUserIds: [] },
      }),
    })
  ).status,
).toBe(400);
expect(state.mutations).toBe(0);
expect((await call({ method: "GET" })).status).toBe(200);
expect(
  (await call({ preview: true, body: JSON.stringify(change) })).status,
).toBe(200);
expect(state.mutations).toBe(0);
state.conflict = true;
expect((await call()).status).toBe(409);
expect(state.expired).toBe(false);
state.conflict = false;
expect((await call()).status).toBe(200);
expect(state.expired).toBe(true);
expect(state.mutations).toBe(1);

const overview = await (await call({ method: "GET" })).json();
async function proxyCall(token: string, fetchSite = "same-origin") {
  return handleUserGroups({
    serverId: "1",
    request: new Request("http://nextjs:3000/api/servers/1/user-groups", {
      method: "POST",
      body: JSON.stringify(input),
      headers: {
        origin: "https://stats.example.com",
        "sec-fetch-site": fetchSite,
        "x-forwarded-host": "stats.example.com",
        "x-forwarded-proto": "https",
        "x-user-groups-csrf": token,
      },
    }),
  });
}
// Proxy headers alone cannot authorize a request. The token comes from the
// authenticated, non-cacheable overview and is bound to the actual admin.
expect((await proxyCall("")).status).toBe(403);
expect((await proxyCall(overview.csrfToken, "cross-site")).status).toBe(403);
expect((await proxyCall(overview.csrfToken, "same-site")).status).toBe(403);
expect((await proxyCall(`0.${"a".repeat(64)}`)).status).toBe(403);
state.actorId = "another-admin";
expect((await proxyCall(overview.csrfToken)).status).toBe(403);
state.actorId = "admin";
expect((await proxyCall(overview.csrfToken)).status).toBe(200);
