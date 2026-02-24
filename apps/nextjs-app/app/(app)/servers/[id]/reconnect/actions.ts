"use server";

import { cookies } from "next/headers";
import { z } from "zod/v4";
import {
  type UpdateServerConnectionResult,
  updateServerConnection,
} from "@/lib/db/server";
import { shouldUseSecureCookies } from "@/lib/secure-cookies";

const updateConnectionSchema = z.object({
  serverId: z.number().int().positive(),
  url: z.string().min(1).max(1000),
  apiKey: z.string().min(1).max(500),
  username: z.string().min(1).max(200),
  password: z.string().max(500).nullish(),
  name: z.string().max(200).optional(),
});

export const updateServerConnectionAction = async (input: {
  serverId: number;
  url: string;
  apiKey: string;
  username: string;
  password?: string | null;
  name?: string;
}): Promise<UpdateServerConnectionResult> => {
  try {
    const parsed = updateConnectionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, message: "Invalid input" };
    }

    const { serverId, url, apiKey, username, password, name } = parsed.data;

    const result = await updateServerConnection({
      serverId,
      url,
      apiKey,
      username,
      password,
      name,
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
