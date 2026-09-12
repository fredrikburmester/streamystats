import { afterEach, describe, expect, test } from "bun:test";
import {
  apiLoginDevice,
  authenticateByName,
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
