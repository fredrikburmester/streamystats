"use server";

import "server-only";

import { cookies, headers } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/secure-cookies";
import { getServerWithSecrets } from "./db/server";
import {
  authenticateWithQuickConnect,
  initiateQuickConnect,
  jellyfinHeaders,
} from "./jellyfin-auth";
import { getInternalUrl } from "./server-url";
import { createSession } from "./session";

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// In-memory rate limiters — per-process only; does not synchronize across instances.
const qcInitTimestamps = new Map<string, number[]>();
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
  if (recent.length >= QC_RATE_LIMIT) {
    throw new Error("Too many QuickConnect attempts. Please try again later.");
  }
  recent.push(now);
  qcInitTimestamps.set(key, recent);
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
  if (recent.length >= LOGIN_RATE_LIMIT) {
    throw new Error("Too many login attempts. Please try again later.");
  }
  recent.push(now);
  loginTimestamps.set(key, recent);
}

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
    throw new Error("Password login is disabled for this server");
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
  enforceQuickConnectRateLimit(serverId, clientIp);

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
