"use server";

import "server-only";

import { cookies } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/secure-cookies";
import { getServerWithSecrets } from "./db/server";
import {
  authenticateWithQuickConnect,
  initiateQuickConnect,
} from "./jellyfin-auth";
import { getInternalUrl } from "./server-url";
import { createSession } from "./session";

export const login = async ({
  serverId,
  username,
  password,
}: {
  serverId: number;
  username: string;
  password?: string | null;
}): Promise<void> => {
  const server = await getServerWithSecrets({ serverId: serverId.toString() });

  if (!server) {
    throw new Error("Server not found");
  }

  const res = await fetch(
    `${getInternalUrl(server)}/Users/AuthenticateByName`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Token": server.apiKey,
      },
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
}): Promise<{ secret: string; code: string }> => {
  const server = await getServerWithSecrets({ serverId: serverId.toString() });
  if (!server) {
    throw new Error("Server not found");
  }

  const result = await initiateQuickConnect({
    serverUrl: getInternalUrl(server),
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  return { secret: result.secret, code: result.code };
};

export const loginWithQuickConnect = async ({
  serverId,
  secret,
}: {
  serverId: number;
  secret: string;
}): Promise<void> => {
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

  const secure = await shouldUseSecureCookies();
  const maxAge = 30 * 24 * 60 * 60;

  await createSession({
    id: result.user.id,
    name: result.user.name ?? "",
    serverId,
    isAdmin: result.user.isAdmin,
  });

  if (result.accessToken) {
    const c = await cookies();
    c.set("streamystats-token", result.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge,
      secure,
    });
  }
};
