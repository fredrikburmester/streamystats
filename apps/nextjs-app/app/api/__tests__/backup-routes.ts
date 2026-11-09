import { beforeEach, describe, expect, test } from "bun:test";

// NOTE: These tests are pure unit tests for the route handlers.
// We mock db/auth/server lookups and the Jellyfin /System/Info request.

type Json = Record<string, unknown>;

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

// Bun module mocking API
const bunMock = await import("bun:test").then((m) => (m as any).mock);

describe("backup export/import routes", () => {
  beforeEach(() => {
    // Reset fetch for each test
    globalThis.fetch = async () =>
      jsonResponse({ Id: "sys-1" }, { status: 200 });
  });

  test("export produces streamystats backup JSON", async () => {
    const fakeDb = {
      query: {
        sessions: {
          findMany: async () => [
            { id: "s1", serverId: 1, userId: "u1", itemId: "i1" },
            { id: "s2", serverId: 1, userId: "u2", itemId: "i2" },
          ],
        },
        hiddenRecommendations: {
          findMany: async () => [
            { id: 1, serverId: 1, userId: "u1", itemId: "i1" },
          ],
        },
      },
    };

    bunMock.module("drizzle-orm", () => ({
      eq: () => ({ mocked: true }),
    }));

    bunMock.module("@/lib/api-auth", () => ({
      requireAdmin: async () => ({ error: null }),
    }));

    bunMock.module("@/lib/db/server", () => ({
      getServerWithSecrets: async () => ({
        id: 1,
        name: "My Server",
        url: "http://jellyfin.local",
        apiKey: "SECRET",
        localAddress: null,
        version: "10.9.0",
        productName: "Jellyfin Server",
        operatingSystem: "Linux",
        startupWizardCompleted: true,
        autoGenerateEmbeddings: false,
        embeddingProvider: null,
        embeddingBaseUrl: null,
        embeddingModel: null,
        embeddingDimensions: 1536,
        chatProvider: null,
        chatBaseUrl: null,
        chatModel: null,
        disabledHolidays: [],
        excludedUserIds: ["u-ignore"],
        excludedLibraryIds: ["lib-ignore"],
      }),
    }));

    bunMock.module("@streamystats/database", () => ({
      db: fakeDb,
      sessions: { serverId: "sessions.serverId" },
      hiddenRecommendations: { serverId: "hiddenRecommendations.serverId" },
    }));

    const { GET } = await import("../export/[serverId]/route");

    const res = await GET({} as any, {
      params: Promise.resolve({ serverId: "1" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Json;

    expect((body.exportInfo as any).version).toBe("streamystats");
    expect((body.exportInfo as any).exportType).toBe("backup");
    expect((body.counts as any).sessions).toBe(2);
    expect((body.counts as any).hiddenRecommendations).toBe(1);

    // server section includes identity hint, but must not include secrets
    expect(((body.server as any).jellyfinSystemId as string) ?? null).toBe(
      "sys-1",
    );
    expect((body.server as any).apiKey).toBeUndefined();
  });

  test("import restores hidden recommendations + sessions", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const deleted: Array<unknown> = [];
    const insertedHidden: Array<unknown> = [];
    const insertedSessions: Array<unknown> = [];

    const fakeDb = {
      query: {
        users: {
          findMany: async () => [{ id: "u1" }, { id: "u2" }],
        },
        items: {
          findMany: async () => [{ id: "i1" }, { id: "i2" }],
        },
      },
      update: () => ({
        set: (data: Record<string, unknown>) => ({
          where: async () => {
            updates.push(data);
          },
        }),
      }),
      delete: () => ({
        where: async (where: unknown) => {
          deleted.push(where);
        },
      }),
      insert: (table: unknown) => ({
        values: (rows: any[]) => {
          const run = async () => {
            if (table && (table as any)._name === "hiddenRecommendations") {
              insertedHidden.push(...rows);
              return;
            }
            insertedSessions.push(...rows);
          };
          return {
            onConflictDoNothing: async () => run(),
            // biome-ignore lint/suspicious/noThenProperty: Intentionally thenable for Drizzle mock
            then: (resolve: any, reject: any) => run().then(resolve, reject),
          };
        },
      }),
    };

    bunMock.module("drizzle-orm", () => ({
      eq: () => ({ mocked: true }),
    }));

    bunMock.module("next/server", () => ({
      NextResponse: {
        json: (body: unknown, init?: ResponseInit) => jsonResponse(body, init),
      },
    }));

    bunMock.module("@/lib/api-auth", () => ({
      requireAdmin: async () => ({ error: null }),
    }));

    bunMock.module("@/lib/db/server", () => ({
      getServerWithSecrets: async () => ({
        id: 99,
        name: "Target Server",
        url: "http://jellyfin.local",
        apiKey: "TARGET_SECRET",
      }),
    }));

    bunMock.module("@streamystats/database", () => ({
      db: fakeDb,
    }));

    // Mock schema tables used only for db builder + eq()
    bunMock.module("@streamystats/database/schema", () => ({
      hiddenRecommendations: {
        _name: "hiddenRecommendations",
        serverId: "hr.serverId",
      },
      items: { id: "items.id", serverId: "items.serverId" },
      users: { id: "users.id", serverId: "users.serverId" },
      servers: { id: "servers.id" },
      sessions: { _name: "sessions" },
    }));

    const backup = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        serverName: "Source",
        serverId: 1,
        version: "streamystats",
        exportType: "backup",
      },
      server: {
        id: 1,
        name: "Source",
        url: "http://jellyfin.local",
        jellyfinSystemId: "sys-1",
        excludedUserIds: ["u-ignore"],
        excludedLibraryIds: ["lib-ignore"],
      },
      sessions: [
        {
          id: "sess-1",
          serverId: 1,
          userId: "u1",
          itemId: "i1",
          userName: "User",
          userServerId: "u1",
          deviceId: null,
          deviceName: null,
          clientName: null,
          applicationVersion: null,
          remoteEndPoint: null,
          itemName: "Item",
          seriesId: null,
          seriesName: null,
          seasonId: null,
          playDuration: 1,
          startTime: null,
          endTime: null,
          lastActivityDate: null,
          lastPlaybackCheckIn: null,
          runtimeTicks: null,
          positionTicks: null,
          percentComplete: null,
          completed: true,
          isPaused: false,
          isMuted: false,
          isActive: false,
          volumeLevel: null,
          audioStreamIndex: null,
          subtitleStreamIndex: null,
          playMethod: null,
          mediaSourceId: null,
          repeatMode: null,
          playbackOrder: null,
          videoCodec: null,
          audioCodec: null,
          resolutionWidth: null,
          resolutionHeight: null,
          videoBitRate: null,
          audioBitRate: null,
          audioChannels: null,
          audioSampleRate: null,
          videoRangeType: null,
          isTranscoded: false,
          transcodingWidth: null,
          transcodingHeight: null,
          transcodingVideoCodec: null,
          transcodingAudioCodec: null,
          transcodingContainer: null,
          transcodingIsVideoDirect: null,
          transcodingIsAudioDirect: null,
          transcodingBitrate: null,
          transcodingCompletionPercentage: null,
          transcodingAudioChannels: null,
          transcodingHardwareAccelerationType: null,
          transcodeReasons: null,
          rawData: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      hiddenRecommendations: [
        {
          id: 1,
          serverId: 1,
          userId: "u1",
          itemId: "i1",
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const file = new File([JSON.stringify(backup)], "backup.json", {
      type: "application/json",
    });
    const formData = new FormData();
    formData.set("file", file, file.name);
    formData.set("serverId", "99");

    const { POST } = await import("../import/route");
    const req = { formData: async () => formData } as any;

    const res = await POST(req);
    expect(res.status).toBe(200);
    const payload = (await res.json()) as any;

    expect(payload.success).toBe(true);
    expect(payload.imported.hidden_recommendations).toBe(1);
    expect(payload.imported.sessions).toBe(1);

    // Server settings updated (exclusions)
    expect(updates.length).toBeGreaterThan(0);
    expect(insertedHidden.length).toBe(1);
    expect(insertedSessions.length).toBe(1);
    expect(deleted.length).toBeGreaterThan(0);
  });
});
