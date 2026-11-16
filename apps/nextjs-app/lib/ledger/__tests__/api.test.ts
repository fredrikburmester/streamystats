import { afterEach, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
import { ledgerRecords, users } from "@streamystats/database";
let authorized = true,
  admin = false,
  currentAdmin = true;
let seen: unknown = null;
const importOptions: boolean[] = [];
const writes: unknown[] = [],
  invalidations: unknown[] = [];
const userList = [
  { id: "viewer", name: "Viewer" },
  { id: "other", name: "Other" },
];
mock.module("server-only", () => ({}));
mock.module("@/lib/db/users", () => ({ validateAdminWithJellyfin: async () => currentAdmin }));
mock.module("@/lib/api-auth", () => ({
  requireSession: async (id: number) =>
    authorized && id === 1
      ? { error: null, session: { id: "viewer", name: "Viewer", serverId: 1, isAdmin: admin } }
      : { error: new Response("Unauthorized", { status: 401 }), session: null },
}));
mock.module("@/lib/ledger/view", () => ({
  getLedgerView: async (args: unknown) => {
    seen = args;
    return { watches: [] };
  },
}));
mock.module("@/lib/ledger/persistence", () => ({
  saveLedgerRows: async (args: {
    serverId: number;
    userId: string;
    rows: Record<string, unknown>[];
    useIncomingDates?: boolean;
  }) => {
    importOptions.push(args.useIncomingDates === true);
    writes.push(
      ...args.rows.map((row) => ({ ...row, serverId: args.serverId, userId: args.userId })),
    );
  },
  resetLedgerCorrections: async (args: unknown) => {
    writes.push(args);
  },
}));
mock.module("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => {
    invalidations.push(args);
  },
}));
mock.module("@streamystats/database", () => ({
  ledgerRecords,
  users,
  db: {
    select: () => ({ from: () => ({ where: () => ({ orderBy: async () => userList }) }) }),
  },
}));
const { GET, POST } = await import("@/app/api/ledger/route");
const request = (body: unknown, suffix = "", origin = "http://localhost") =>
  new NextRequest(`http://localhost/api/ledger?serverId=1${suffix}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const manual = {
  action: "manual",
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  entry: {
    title: { key: "movie:test", name: "Test", kind: "movie" },
    watchedAt: "2026-10-29T18:00:00.000000Z",
    accuracy: "accurate",
    runtime: 7200,
    completed: true,
  },
};
afterEach(() => {
  authorized = true;
  admin = false;
  currentAdmin = true;
  seen = null;
  writes.length = 0;
  importOptions.length = 0;
  invalidations.length = 0;
});
test("session and server boundaries are enforced", async () => {
  authorized = false;
  expect((await GET(new NextRequest("http://localhost/api/ledger?serverId=1"))).status).toBe(401);
  authorized = true;
  expect((await GET(new NextRequest("http://localhost/api/ledger?serverId=2"))).status).toBe(401);
});
test("ordinary users cannot select another ledger for reads or writes", async () => {
  expect(
    (await GET(new NextRequest("http://localhost/api/ledger?serverId=1&userId=other"))).status,
  ).toBe(403);
  expect((await POST(request(manual, "&userId=other"))).status).toBe(403);
  expect(seen).toBeNull();
  expect(writes).toHaveLength(0);
});
test("a demoted admin cannot read or modify another ledger", async () => {
  admin = true;
  currentAdmin = false;
  expect(
    (await GET(new NextRequest("http://localhost/api/ledger?serverId=1&userId=other"))).status,
  ).toBe(403);
  expect((await POST(request(manual, "&userId=other"))).status).toBe(403);
  expect(writes).toHaveLength(0);
});
test("verified admins can select a current same-server user", async () => {
  admin = true;
  expect(
    (await GET(new NextRequest("http://localhost/api/ledger?serverId=1&userId=other"))).status,
  ).toBe(200);
  expect(seen).toMatchObject({ serverId: 1, userId: "other" });
  expect((await POST(request(manual, "&userId=other"))).status).toBe(200);
  expect(writes[0]).toMatchObject({ userId: "other" });
});
test("unknown users remain inaccessible to an admin", async () => {
  admin = true;
  expect(
    (await GET(new NextRequest("http://localhost/api/ledger?serverId=1&userId=outside"))).status,
  ).toBe(403);
});
test("cross-origin writes are rejected", async () => {
  expect((await POST(request(manual, "", "https://other.example"))).status).toBe(403);
  expect(writes).toHaveLength(0);
});
test("manual request keys remain stable and body userId cannot change scope", async () => {
  for (let n = 0; n < 2; n++)
    expect((await POST(request({ ...manual, userId: "other" }))).status).toBe(200);
  expect(writes[0]).toMatchObject({
    sourceKey: manual.idempotencyKey,
    userId: "viewer",
    kind: "manual",
  });
  expect(writes[1]).toEqual(writes[0]);
});
test("manual logs require an idempotency key and episode identity", async () => {
  expect((await POST(request({ ...manual, idempotencyKey: undefined }))).status).toBe(400);
  expect(
    (
      await POST(
        request({
          ...manual,
          entry: { ...manual.entry, title: { ...manual.entry.title, kind: "tv" } },
        }),
      )
    ).status,
  ).toBe(400);
  expect(writes).toHaveLength(0);
});
test("settings accept sparse updates and normalize prior-title identities", async () => {
  expect(
    (
      await POST(
        request({ action: "settings", settings: { confirmedPriorTitles: ["Example Show"] } }),
      )
    ).status,
  ).toBe(200);
  expect(writes[0]).toMatchObject({ payload: { confirmedPriorTitles: ["exampleshow"] } });
});
test("saving and resetting corrections immediately expire all-year ledger caches", async () => {
  expect(
    (await POST(request({ action: "correct", key: "play:one", patch: { completed: true } })))
      .status,
  ).toBe(200);
  expect(invalidations).toContainEqual(["ledger-1-viewer", { expire: 0 }]);
  invalidations.length = 0;
  expect((await POST(request({ action: "resetCorrection", key: "play:one" }))).status).toBe(200);
  expect(invalidations).toContainEqual(["ledger-1-viewer", { expire: 0 }]);
});

test("invalid timezones are rejected and incoming manual timestamps normalize to microseconds", async () => {
  expect((await POST(request({ action: "settings", settings: { timezone: "" } }))).status).toBe(
    400,
  );
  expect(
    (await POST(request({ action: "settings", settings: { timezone: "invalid/timezone" } })))
      .status,
  ).toBe(400);
  expect(
    (
      await POST(
        request({ ...manual, entry: { ...manual.entry, watchedAt: "2026-10-29T18:00:00.123Z" } }),
      )
    ).status,
  ).toBe(200);
  expect(writes[0]).toMatchObject({ payload: { watchedAt: "2026-10-29T18:00:00.123000Z" } });
});

test("the shared source switch accepts true and false without replacing other settings", async () => {
  for (const includeImportedStats of [true, false]) {
    expect(
      (await POST(request({ action: "settings", settings: { includeImportedStats } }))).status,
    ).toBe(200);
  }
  expect(writes[0]).toMatchObject({ payload: { includeImportedStats: true } });
  expect(writes[1]).toMatchObject({ payload: { includeImportedStats: false } });
  expect(invalidations).toContainEqual(["ledger-stats-1", { expire: 0 }]);
});

const importRequest = ({
  mode,
  name = "backup.json",
  suffix = "",
}: {
  mode?: string;
  name?: string;
  suffix?: string;
}) => {
  const form = new FormData();
  form.set(
    "file",
    new File(
      [
        JSON.stringify({
          shows: [
            {
              show: { title: "Example", ids: { simkl: 1 }, runtime: 54 },
              seasons: [
                { number: 1, episodes: [{ number: 1, watched_at: "2026-03-01T12:00:00Z" }] },
              ],
            },
          ],
        }),
      ],
      name,
    ),
  );
  if (mode !== undefined) form.set("importMode", mode);
  return new NextRequest(`http://localhost/api/ledger?serverId=1${suffix}`, {
    method: "POST",
    headers: { origin: "http://localhost" },
    body: form,
  });
};
test("only explicit JSON reimports enable corrected earlier dates and invalidate statistics", async () => {
  expect((await POST(importRequest({}))).status).toBe(200);
  expect(importOptions).toEqual([false]);
  expect((await POST(importRequest({ mode: "use-import-dates" }))).status).toBe(200);
  expect(importOptions).toEqual([false, true]);
  expect(writes[1]).toMatchObject({ userId: "viewer", kind: "simkl-json" });
  expect(invalidations).toContainEqual(["ledger-stats-1", { expire: 0 }]);
});
test("date replacement imports retain access checks and reject invalid modes and ZIPs", async () => {
  expect(
    (await POST(importRequest({ mode: "use-import-dates", suffix: "&userId=other" }))).status,
  ).toBe(403);
  expect((await POST(importRequest({ mode: "delete-everything" }))).status).toBe(400);
  const zip = await POST(importRequest({ mode: "use-import-dates", name: "backup.zip" }));
  expect(zip.status).toBe(400);
  expect((await zip.json()).error).toContain("Extract the SIMKL ZIP");
  expect(writes).toHaveLength(0);
});
