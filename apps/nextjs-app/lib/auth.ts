"use server";

import "server-only";

import { cookies, headers } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/secure-cookies";
import { getServerWithSecrets } from "./db/server";
import {
  authenticateWithQuickConnect,
  checkQuickConnectEnabled,
  initiateQuickConnect,
  jellyfinHeaders,
} from "./jellyfin-auth";
import { getInternalUrl } from "./server-url";
import { createSession } from "./session";

// Assumes a trusted reverse proxy strips and sets x-forwarded-for.
// Without a trusted proxy, clients can spoof this header to bypass rate limiting.
async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// In-memory rate limiters — per-process only; does not synchronize across instances.
const MAX_RATE_LIMIT_KEYS = 10_000;

function pruneExpiredEntries(map: Map<string, number[]>, windowMs: number) {
  const now = Date.now();
  for (const [key, timestamps] of map) {
    const recent = timestamps.filter((t) => now - t < windowMs);
    if (recent.length === 0) map.delete(key);
    else map.set(key, recent);
  }
}

const qcInitTimestamps = new Map<string, number[]>();
const qcCompleteTimestamps = new Map<string, number[]>();
const QC_RATE_LIMIT = 5;
const QC_RATE_WINDOW_MS = 60_000;

function enforceQuickConnectRateLimit(
  serverId: number,
  clientIp: string,
): void {
  const key = `${serverId}:${clientIp}`;
  const now = Date.now();
  const recent = (qcInitTimestamps.get(key) ?? []).filter(
    (t) => now - t < QC_RATE_WINDOW_MS,
  );
  const effectiveLimit =
    clientIp === "unknown"
      ? Math.max(1, Math.floor(QC_RATE_LIMIT / 5))
      : QC_RATE_LIMIT;
  if (recent.length >= effectiveLimit) {
    throw new Error("Too many QuickConnect attempts. Please try again later.");
  }
  if (!qcInitTimestamps.has(key) && qcInitTimestamps.size >= MAX_RATE_LIMIT_KEYS) {
    throw new Error("Too many QuickConnect attempts. Please try again later.");
  }
  recent.push(now);
  qcInitTimestamps.set(key, recent);
}

function enforceQuickConnectCompleteRateLimit(
  serverId: number,
  clientIp: string,
): void {
  const key = `${serverId}:${clientIp}`;
  const now = Date.now();
  const recent = (qcCompleteTimestamps.get(key) ?? []).filter(
    (t) => now - t < QC_RATE_WINDOW_MS,
  );
  const effectiveLimit =
    clientIp === "unknown"
      ? Math.max(1, Math.floor(QC_RATE_LIMIT / 5))
      : QC_RATE_LIMIT;
  if (recent.length >= effectiveLimit) {
    throw new Error("Too many QuickConnect attempts. Please try again later.");
  }
  if (!qcCompleteTimestamps.has(key) && qcCompleteTimestamps.size >= MAX_RATE_LIMIT_KEYS) {
    throw new Error("Too many QuickConnect attempts. Please try again later.");
  }
  recent.push(now);
  qcCompleteTimestamps.set(key, recent);
}

const loginTimestamps = new Map<string, number[]>();
const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 60_000;

function enforceLoginRateLimit(serverId: number, clientIp: string): void {
  const key = `${serverId}:${clientIp}`;
  const now = Date.now();
  const recent = (loginTimestamps.get(key) ?? []).filter(
    (t) => now - t < LOGIN_RATE_WINDOW_MS,
  );
  const effectiveLimit =
    clientIp === "unknown"
      ? Math.max(1, Math.floor(LOGIN_RATE_LIMIT / 5))
      : LOGIN_RATE_LIMIT;
  if (recent.length >= effectiveLimit) {
    throw new Error("Too many login attempts. Please try again later.");
  }
  if (!loginTimestamps.has(key) && loginTimestamps.size >= MAX_RATE_LIMIT_KEYS) {
    throw new Error("Too many login attempts. Please try again later.");
  }
  recent.push(now);
  loginTimestamps.set(key, recent);
}

setInterval(() => {
  pruneExpiredEntries(qcInitTimestamps, QC_RATE_WINDOW_MS);
  pruneExpiredEntries(qcCompleteTimestamps, QC_RATE_WINDOW_MS);
  pruneExpiredEntries(loginTimestamps, LOGIN_RATE_WINDOW_MS);
}, 5 * 60_000).unref();

export const login = async ({
  serverId,
  username,
  password,
}: {
  serverId: number;
  username: string;
  password?: string | null;
}): Promise<void> => {
  const clientIp = await getClientIp();
  enforceLoginRateLimit(serverId, clientIp);

  const server = await getServerWithSecrets({ serverId: serverId.toString() });

  if (!server) {
    throw new Error("Server not found");
  }

  if (server.disablePasswordLogin) {
    const qcAvailable = await checkQuickConnectEnabled({
      serverUrl: getInternalUrl(server),
    });
    if (qcAvailable) {
      throw new Error("Password login is disabled for this server");
    }
  }

  const res = await fetch(
    `${getInternalUrl(server)}/Users/AuthenticateByName`,
    {
      method: "POST",
      headers: jellyfinHeaders(server.apiKey),
      body: JSON.stringify({ Username: username, Pw: password }),
    },
  );

  if (!res.ok) {
    throw new Error("Failed to login");
  }

  const data = await res.json();

  const accessToken = data.AccessToken;
  const user = data.User;
  const isAdmin = user.Policy.IsAdministrator;

  const secure = await shouldUseSecureCookies();
  const maxAge = 30 * 24 * 60 * 60;

  // Create signed session (tamper-proof)
  await createSession({
    id: user.Id,
    name: user.Name,
    serverId,
    isAdmin,
  });

  // Store Jellyfin access token separately for API calls
  const c = await cookies();
  c.set("streamystats-token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure,
  });
};

export const initiateQuickConnectLogin = async ({
  serverId,
}: {
  serverId: number;
}): Promise<
  { ok: true; secret: string; code: string } | { ok: false; error: string }
> => {
  try {
    const clientIp = await getClientIp();
    enforceQuickConnectRateLimit(serverId, clientIp);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Rate limited",
    };
  }

  const server = await getServerWithSecrets({ serverId: serverId.toString() });
  if (!server) {
    return { ok: false, error: "Server not found" };
  }

  const result = await initiateQuickConnect({
    serverUrl: getInternalUrl(server),
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, secret: result.secret, code: result.code };
};

export const loginWithQuickConnect = async ({
  serverId,
  secret,
}: {
  serverId: number;
  secret: string;
}): Promise<void> => {
  const clientIp = await getClientIp();
  enforceQuickConnectCompleteRateLimit(serverId, clientIp);

  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error("Invalid QuickConnect secret");
  }

  const server = await getServerWithSecrets({ serverId: serverId.toString() });
  if (!server) {
    throw new Error("Server not found");
  }

  const result = await authenticateWithQuickConnect({
    serverUrl: getInternalUrl(server),
    secret,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  if (!result.accessToken) {
    throw new Error("Jellyfin did not return an access token");
  }

  const secure = await shouldUseSecureCookies();
  const maxAge = 30 * 24 * 60 * 60;

  await createSession({
    id: result.user.id,
    name: result.user.name ?? "",
    serverId,
    isAdmin: result.user.isAdmin,
  });

  const c = await cookies();
  c.set("streamystats-token", result.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure,
  });
};
