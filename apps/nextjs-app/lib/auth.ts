"use server";

import "server-only";

import { cookies } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/secure-cookies";
import { parseDeviceName } from "./device";
import { getServerWithSecrets } from "./db/server";
import { jellyfinHeaders } from "./jellyfin-auth";
import { getInternalUrl } from "./server-url";
import { createSession } from "./session";

export const login = async ({
  serverId,
  username,
  password,
  userAgent,
}: {
  serverId: number;
  username: string;
  password?: string | null;
  userAgent?: string;
}): Promise<void> => {
  const server = await getServerWithSecrets({ serverId: serverId.toString() });

  if (!server) {
    throw new Error("Server not found");
  }

  // Each browser session gets a unique DeviceId so Jellyfin tracks them as
  // separate devices. Without this, re-authenticating revokes the previous
  // token and breaks multi-device sessions (#370).
  const device = {
    id: crypto.randomUUID(),
    name: userAgent ? parseDeviceName(userAgent) : "Streamystats Web",
  };

  const res = await fetch(
    `${getInternalUrl(server)}/Users/AuthenticateByName`,
    {
      method: "POST",
      headers: jellyfinHeaders(server.apiKey, device),
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
