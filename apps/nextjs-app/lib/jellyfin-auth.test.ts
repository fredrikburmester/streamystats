import { afterEach, describe, expect, test } from "bun:test";
import {
  apiLoginDevice,
  authenticateByName,
  getUserFromEmbyToken,
  isServerApiKey,
  jellyfinClientHeaders,
  jellyfinHeaders,
} from "./jellyfin-auth";
import { STREAMYSTATS_VERSION } from "./version";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function parseMediaBrowser(header: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const match of header.matchAll(/(\w+)="([^"]*)"/g)) {
    values[match[1]] = match[2];
  }
  return values;
}

describe("MediaBrowser headers", () => {
  test("jellyfinHeaders carries client, version and token", () => {
    const parsed = parseMediaBrowser(jellyfinHeaders("tok123").Authorization);

    expect(parsed).toEqual({
      Client: "Streamystats",
      Version: STREAMYSTATS_VERSION,
      Token: "tok123",
    });
  });

  test("jellyfinClientHeaders identifies the device without a token", () => {
    const parsed = parseMediaBrowser(
      jellyfinClientHeaders({ id: "dev-1", name: "Chrome" }).Authorization,
    );

    expect(parsed).toEqual({
      Client: "Streamystats",
      Device: "Chrome",
      DeviceId: "dev-1",
      Version: STREAMYSTATS_VERSION,
    });
    expect(parsed.Token).toBeUndefined();
  });

  test("the version is the released package version, not a stale constant", () => {
    expect(STREAMYSTATS_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(STREAMYSTATS_VERSION).not.toBe("2.16.0");
  });

  test("apiLoginDevice is stable per user and safe inside a quoted header", () => {
    expect(apiLoginDevice("Alice")).toEqual(apiLoginDevice("alice "));
    expect(apiLoginDevice('a"b').id).not.toContain('"');
  });
});

describe("authenticateByName", () => {
  test("sends the MediaBrowser identity Jellyfin requires for password logins", async () => {
    let captured: { url: string; init?: RequestInit } | null = null;
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      captured = { url: String(input), init };
      return new Response(
        JSON.stringify({
          AccessToken: "token-abc",
          User: { Id: "u1", Name: "alice", Policy: { IsAdministrator: false } },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await authenticateByName({
      serverUrl: "http://jellyfin.local/",
      username: "alice",
      password: "password",
    });

    expect(result).toEqual({
      ok: true,
      user: { id: "u1", name: "alice", isAdmin: false },
      accessToken: "token-abc",
    });
    const request = captured as { url: string; init?: RequestInit } | null;
    expect(request?.url).toBe("http://jellyfin.local/Users/AuthenticateByName");
    const headers = request?.init?.headers as Record<string, string>;
    const parsed = parseMediaBrowser(headers.Authorization);
    expect(parsed.Client).toBe("Streamystats");
    expect(parsed.Device).toBe("Streamystats API");
    expect(parsed.DeviceId).toBe("streamystats-api-alice");
    expect(parsed.Version).toBe(STREAMYSTATS_VERSION);
    expect(parsed.Token).toBeUndefined();
    expect(JSON.parse(String(request?.init?.body))).toEqual({
      Username: "alice",
      Pw: "password",
    });
  });

  test("maps a 401 to an invalid-credentials error", async () => {
    globalThis.fetch = (async () =>
      new Response("", { status: 401 })) as typeof fetch;

    const result = await authenticateByName({
      serverUrl: "http://jellyfin.local",
      username: "alice",
      password: "wrong",
    });

    expect(result).toEqual({
      ok: false,
      error: "Invalid username or password",
    });
  });
});

describe("getUserFromEmbyToken", () => {
  test("does not turn a failed /Users/Me into the admin API key identity", async () => {
    const paths: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      if (path === "/Users/Me") throw new TypeError("fetch failed");
      return Response.json({ Id: "jellyfin-server" });
    }) as typeof fetch;

    const result = await getUserFromEmbyToken({
      serverUrl: "http://jellyfin.local",
      token: "user-token",
    });

    expect(result).toEqual({ ok: false, error: "fetch failed" });
    expect(paths).toEqual(["/Users/Me"]);
  });
});

describe("isServerApiKey", () => {
  const apiKeys = (...accessTokens: string[]) =>
    Response.json({
      Items: accessTokens.map((AccessToken) => ({ AccessToken })),
      TotalRecordCount: accessTokens.length,
    });

  test("accepts a token the server lists among its API keys", async () => {
    let captured: { url: string; init?: RequestInit } | null = null;
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      captured = { url: String(input), init };
      return apiKeys("another-key", "key-1");
    }) as typeof fetch;

    const result = await isServerApiKey({
      serverUrl: "http://jellyfin.local/",
      token: "key-1",
    });

    expect(result).toBe(true);
    const request = captured as { url: string; init?: RequestInit } | null;
    expect(request?.url).toBe("http://jellyfin.local/Auth/Keys");
    const headers = request?.init?.headers as Record<string, string>;
    expect(parseMediaBrowser(headers.Authorization).Token).toBe("key-1");
  });

  test("rejects an administrator's token, which Jellyfin answers but does not list", async () => {
    globalThis.fetch = (async () => apiKeys("key-1")) as typeof fetch;

    const result = await isServerApiKey({
      serverUrl: "http://jellyfin.local",
      token: "admin-user-token",
    });

    expect(result).toBe(false);
  });

  test("rejects a token Jellyfin won't show the key list", async () => {
    for (const status of [401, 403]) {
      globalThis.fetch = (async () =>
        new Response("", { status })) as typeof fetch;

      const result = await isServerApiKey({
        serverUrl: "http://jellyfin.local",
        token: "user-token",
      });

      expect(result).toBe(false);
    }
  });

  test("rejects when the key list can't be read", async () => {
    const answers: Array<() => Response> = [
      () => {
        throw new TypeError("fetch failed");
      },
      () => new Response("not json"),
      () => Response.json({ Items: null }),
      () => Response.json(null),
    ];
    for (const answer of answers) {
      globalThis.fetch = (async () => answer()) as typeof fetch;

      const result = await isServerApiKey({
        serverUrl: "http://jellyfin.local",
        token: "key-1",
      });

      expect(result).toBe(false);
    }
  });
});
