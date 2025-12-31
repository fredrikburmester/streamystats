"use server";

import { cookies } from "next/headers";
import {
  type UpdateServerConnectionResult,
  updateServerConnection,
} from "@/lib/db/server";
import { shouldUseSecureCookies } from "@/lib/secure-cookies";

export const updateServerConnectionAction = async ({
  serverId,
  url,
  internalUrl,
  apiKey,
  username,
  password,
}: {
  serverId: number;
  url: string;
  internalUrl?: string | null;
  apiKey: string;
  username: string;
  password?: string | null;
}): Promise<UpdateServerConnectionResult> => {
  try {
    const result = await updateServerConnection({
      serverId,
      url,
      internalUrl,
      apiKey,
      username,
      password,
    });

    if (result.success && result.accessToken && result.userId) {
      const secure = await shouldUseSecureCookies();
      const maxAge = 30 * 24 * 60 * 60;

      const c = await cookies();

      c.set("streamystats-token", result.accessToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge,
        secure,
      });

      c.set(
        "streamystats-user",
        JSON.stringify({
          name: result.username ?? username,
          id: result.userId,
          serverId,
        }),
        {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge,
          secure,
        },
      );
    }

    return result;
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update server connection",
    };
  }
};
