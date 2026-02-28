"use server";

import { db, servers } from "@streamystats/database";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { deleteServer as deleteServerFromDb } from "@/lib/db/server";
import { isUserAdmin } from "@/lib/db/users";

const deleteServerSchema = z.object({
  serverId: z.number().int().positive(),
});

const updateTimezoneSchema = z.object({
  serverId: z.number().int().positive(),
  timezone: z.string().min(1).max(100),
});

export async function deleteServerAction(serverId: number) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return { success: false, message: "Admin privileges required" };
    }

    const parsed = deleteServerSchema.safeParse({ serverId });
    if (!parsed.success) {
      return { success: false, message: "Invalid server ID" };
    }

    const result = await deleteServerFromDb({
      serverId: parsed.data.serverId,
    });

    if (result.success) {
      revalidatePath("/");
      revalidatePath("/servers");
      return { success: true, message: result.message };
    }
    return { success: false, message: result.message };
  } catch (error) {
    console.error("Server action - Error deleting server:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete server",
    };
  }
}

interface UpdateConnectionSettingsParams {
  serverId: number;
  url: string;
  internalUrl?: string | null;
  apiKey?: string;
}

interface UpdateConnectionSettingsResult {
  success: boolean;
  message: string;
}

/**
 * Server action to update connection settings (URL, internal URL, API key)
 * This action does not require re-authentication and should only be used by admins
 */
export async function updateConnectionSettingsAction({
  serverId,
  url,
  internalUrl,
  apiKey,
}: UpdateConnectionSettingsParams): Promise<UpdateConnectionSettingsResult> {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return { success: false, message: "Admin privileges required" };
    }

    // Fetch existing server to get current API key if none provided
    const existingServer = await db
      .select({ apiKey: servers.apiKey })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    if (existingServer.length === 0) {
      return {
        success: false,
        message: "Server not found",
      };
    }

    // Use provided API key or fall back to existing one
    const effectiveApiKey = apiKey || existingServer[0].apiKey;

    if (!effectiveApiKey) {
      return {
        success: false,
        message: "No API key available. Please provide an API key.",
      };
    }

    // Validate URL format
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return {
        success: false,
        message: "URL must start with http:// or https://",
      };
    }

    // Normalize URLs by removing trailing slashes
    const normalizedUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const normalizedInternalUrl = internalUrl
      ? internalUrl.endsWith("/")
        ? internalUrl.slice(0, -1)
        : internalUrl
      : null;

    // Validate internal URL format if provided
    if (
      normalizedInternalUrl &&
      !normalizedInternalUrl.startsWith("http://") &&
      !normalizedInternalUrl.startsWith("https://")
    ) {
      return {
        success: false,
        message: "Internal URL must start with http:// or https://",
      };
    }

    // Test connection to new URL with the API key
    try {
      const testResponse = await fetch(`${normalizedUrl}/System/Info`, {
        method: "GET",
        headers: {
          "X-Emby-Token": effectiveApiKey,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!testResponse.ok) {
        let errorMessage = "Failed to connect to server.";
        if (testResponse.status === 401) {
          errorMessage = "Invalid API key. Please check your Jellyfin API key.";
        } else if (testResponse.status === 404) {
          errorMessage = "Server not found. Please check the URL.";
        } else if (testResponse.status === 403) {
          errorMessage =
            "Access denied. Please check your API key permissions.";
        }
        return {
          success: false,
          message: errorMessage,
        };
      }

      const serverInfo = (await testResponse.json()) as {
        ServerName?: string;
        Version?: string;
      };

      // Validate internal URL connectivity if provided
      if (normalizedInternalUrl) {
        try {
          const internalResponse = await fetch(
            `${normalizedInternalUrl}/System/Info`,
            {
              method: "GET",
              headers: {
                "X-Emby-Token": effectiveApiKey,
                "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(5000),
            },
          );

          if (!internalResponse.ok) {
            return {
              success: false,
              message:
                "Internal URL is unreachable. Please check the URL and try again.",
            };
          }
        } catch {
          return {
            success: false,
            message:
              "Failed to connect to internal URL. Please check the URL and try again.",
          };
        }
      }

      const updateData: {
        url: string;
        internalUrl: string | null;
        apiKey?: string;
        version?: string;
        name?: string;
        updatedAt: Date;
      } = {
        url: normalizedUrl,
        internalUrl: normalizedInternalUrl,
        updatedAt: new Date(),
      };

      if (serverInfo.Version) {
        updateData.version = serverInfo.Version;
      }
      if (serverInfo.ServerName) {
        updateData.name = serverInfo.ServerName;
      }
      if (apiKey) {
        updateData.apiKey = apiKey;
      }

      await db.update(servers).set(updateData).where(eq(servers.id, serverId));

      // Revalidate relevant paths
      revalidatePath(`/servers/${serverId}/settings`);

      return {
        success: true,
        message: "Connection settings updated successfully",
      };
    } catch (fetchError) {
      if (
        fetchError instanceof Error &&
        (fetchError.name === "AbortError" ||
          fetchError.message.includes("timeout"))
      ) {
        return {
          success: false,
          message: "Connection timeout. Please check the URL and try again.",
        };
      }
      return {
        success: false,
        message: "Failed to connect to server. Please check the URL.",
      };
    }
  } catch (error) {
    console.error("Error updating connection settings:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update connection settings",
    };
  }
}

export async function updateServerTimezoneAction(
  serverId: number,
  timezone: string,
) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return { success: false, message: "Admin privileges required" };
    }

    const parsed = updateTimezoneSchema.safeParse({ serverId, timezone });
    if (!parsed.success) {
      return { success: false, message: "Invalid input" };
    }

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: parsed.data.timezone });
    } catch {
      return { success: false, message: "Invalid timezone identifier" };
    }

    await db
      .update(servers)
      .set({ timezone: parsed.data.timezone, updatedAt: new Date() })
      .where(eq(servers.id, parsed.data.serverId));

    revalidatePath(`/servers/${parsed.data.serverId}`);

    return { success: true, message: "Timezone updated successfully" };
  } catch (error) {
    console.error("Server action - Error updating timezone:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update timezone",
    };
  }
}
