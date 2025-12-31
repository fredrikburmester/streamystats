"use server";

import { db, servers } from "@streamystats/database";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { deleteServer as deleteServerFromDb } from "@/lib/db/server";

/**
 * Server action to delete a server
 * @param serverId - The ID of the server to delete
 */
export async function deleteServerAction(serverId: number) {
  try {
    const result = await deleteServerFromDb({ serverId });

    if (result.success) {
      // Revalidate relevant paths
      revalidatePath("/");
      revalidatePath("/servers");

      // Return success result
      return {
        success: true,
        message: result.message,
      };
    }
    return {
      success: false,
      message: result.message,
    };
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

      // Build update object - only include apiKey if a new one was provided
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
        version: serverInfo.Version ?? undefined,
        name: serverInfo.ServerName ?? undefined,
        updatedAt: new Date(),
      };

      // Only update API key if a new one was explicitly provided
      if (apiKey) {
        updateData.apiKey = apiKey;
      }

      // Update the server record
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
