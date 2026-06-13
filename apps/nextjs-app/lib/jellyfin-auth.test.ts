import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
  getUserFromEmbyToken,
  isTransientJellyfinStatus,
} from "./jellyfin-auth";

// Scope the fetch mock to each test via spyOn + mockRestore, so the global
// is always restored afterwards and tests can't interfere with one another.
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

beforeEach(() => {
  fetchSpy = spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Install a per-test fetch mock that returns a configured status per Jellyfin
 * endpoint and records which endpoints were hit, so tests can assert the
 * fallback was (or was not) attempted.
 */
function mockJellyfin(opts: {
  usersMe: { status: number; body?: unknown };
  systemInfo?: { status: number };
}) {
  const calls: string[] = [];
  fetchSpy.mockImplementation((async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/Users/Me")) {
      calls.push("/Users/Me");
      return jsonResponse(opts.usersMe.body ?? {}, opts.usersMe.status);
    }
    if (url.includes("/System/Info")) {
      calls.push("/System/Info");
      return jsonResponse({ Id: "sys-1" }, opts.systemInfo?.status ?? 500);
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch);
  return calls;
}

describe("isTransientJellyfinStatus", () => {
  test("429 and 5xx are transient", () => {
    expect(isTransientJellyfinStatus(429)).toBe(true);
    expect(isTransientJellyfinStatus(500)).toBe(true);
    expect(isTransientJellyfinStatus(503)).toBe(true);
  });

  test("4xx (except 429) are not transient", () => {
    expect(isTransientJellyfinStatus(400)).toBe(false);
    expect(isTransientJellyfinStatus(401)).toBe(false);
    expect(isTransientJellyfinStatus(403)).toBe(false);
    expect(isTransientJellyfinStatus(404)).toBe(false);
  });
});

describe("getUserFromEmbyToken", () => {
  test("user access token: returns identity from /Users/Me", async () => {
    mockJellyfin({
      usersMe: {
        status: 200,
        body: {
          Id: "user-1",
          Name: "Alice",
          Policy: { IsAdministrator: true },
        },
      },
    });

    const result = await getUserFromEmbyToken({
      serverUrl: "http://jf.local",
      token: "user-token",
    });

    expect(result).toEqual({
      ok: true,
      user: { id: "user-1", name: "Alice", isAdmin: true },
    });
  });

  // Regression guard: a Jellyfin server API key gets 400 (not 401) from
  // /Users/Me. The fallback must still fire and surface the admin pseudo-user.
  test("server API key: 400 from /Users/Me falls back to /System/Info", async () => {
    const calls = mockJellyfin({
      usersMe: { status: 400 },
      systemInfo: { status: 200 },
    });

    const result = await getUserFromEmbyToken({
      serverUrl: "http://jf.local",
      token: "api-key",
    });

    expect(result).toEqual({
      ok: true,
      user: { id: "system-api-key", name: "System API Key", isAdmin: true },
    });
    expect(calls).toEqual(["/Users/Me", "/System/Info"]);
  });

  test("invalid token: 401 from both endpoints rejects", async () => {
    mockJellyfin({
      usersMe: { status: 401 },
      systemInfo: { status: 401 },
    });

    const result = await getUserFromEmbyToken({
      serverUrl: "http://jf.local",
      token: "bad-token",
    });

    expect(result).toEqual({
      ok: false,
      error: "Invalid Authorization header",
    });
  });

  // Transient failures must NOT probe /System/Info — they stay retryable.
  test("transient 503 from /Users/Me does not attempt key validation", async () => {
    const calls = mockJellyfin({
      usersMe: { status: 503 },
      systemInfo: { status: 200 },
    });

    const result = await getUserFromEmbyToken({
      serverUrl: "http://jf.local",
      token: "any-token",
    });

    expect(result).toEqual({ ok: false, error: "Jellyfin returned 503" });
    expect(calls).toEqual(["/Users/Me"]);
  });

  test("400 from /Users/Me but invalid key: /System/Info 401 rejects", async () => {
    mockJellyfin({
      usersMe: { status: 400 },
      systemInfo: { status: 401 },
    });

    const result = await getUserFromEmbyToken({
      serverUrl: "http://jf.local",
      token: "revoked-key",
    });

    expect(result.ok).toBe(false);
  });
});
