"use server";

import { cookies, headers } from "next/headers";
import {
  updateServerConnection,
  UpdateServerConnectionResult,
} from "@/lib/db/server";

export const updateServerConnectionAction = async ({
  serverId,
  url,
  apiKey,
  username,
  password,
  name,
}: {
  serverId: number;
  url: string;
  apiKey: string;
  username: string;
  password?: string | null;
  name?: string;
}): Promise<UpdateServerConnectionResult> => {
  try {
    const result = await updateServerConnection({
      serverId,
      url,
      apiKey,
      username,
      password,
      name,
    });

    if (result.success && result.accessToken && result.userId) {
      const h = await headers();
      const secure = h.get("x-forwarded-proto") === "https";
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
          name: username,
          id: result.userId,
          serverId,
        }),
        {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge,
          secure,
        }
      );

      c.set("show-admin-statistics", result.isAdmin ? "true" : "false", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge,
        secure,
      });
    }

    return result;
  } catch (error) {
    console.error("Error in updateServerConnectionAction:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update server connection",
    };
  }
};

