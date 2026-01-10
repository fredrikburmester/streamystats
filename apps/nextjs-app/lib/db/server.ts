"use server";

import { db, items, jobResults, servers } from "@streamystats/database";
import type { EmbeddingJobResult, Server } from "@streamystats/database/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { ServerPublic } from "@/lib/types";

type ServerPublicSelectRow = Omit<
  ServerPublic,
  "hasChatApiKey" | "hasEmbeddingApiKey"
> & {
  embeddingApiKey: string | null;
  chatApiKey: string | null;
};

const SERVER_PUBLIC_SELECT = {
  id: servers.id,
  jellyfinId: servers.jellyfinId,
  name: servers.name,
  url: servers.url,
  lastSyncedPlaybackId: servers.lastSyncedPlaybackId,
  localAddress: servers.localAddress,
  version: servers.version,
  productName: servers.productName,
  operatingSystem: servers.operatingSystem,
  startupWizardCompleted: servers.startupWizardCompleted,
  autoGenerateEmbeddings: servers.autoGenerateEmbeddings,
  testMigrationField: servers.testMigrationField,
  embeddingProvider: servers.embeddingProvider,
  embeddingBaseUrl: servers.embeddingBaseUrl,
  embeddingModel: servers.embeddingModel,
  embeddingDimensions: servers.embeddingDimensions,
  chatProvider: servers.chatProvider,
  chatBaseUrl: servers.chatBaseUrl,
  chatModel: servers.chatModel,
  syncStatus: servers.syncStatus,
  syncProgress: servers.syncProgress,
  syncError: servers.syncError,
  lastSyncStarted: servers.lastSyncStarted,
  lastSyncCompleted: servers.lastSyncCompleted,
  disabledHolidays: servers.disabledHolidays,
  excludedUserIds: servers.excludedUserIds,
  excludedLibraryIds: servers.excludedLibraryIds,
  embeddingStopRequested: servers.embeddingStopRequested,
  timezone: servers.timezone,
  createdAt: servers.createdAt,
  updatedAt: servers.updatedAt,
  // Select secrets only to compute boolean flags; never return them to callers
  embeddingApiKey: servers.embeddingApiKey,
  chatApiKey: servers.chatApiKey,
} satisfies Record<string, unknown>;

function toServerPublic(row: ServerPublicSelectRow): ServerPublic {
  const { embeddingApiKey, chatApiKey, ...rest } = row;
  return {
    ...(rest as Omit<ServerPublic, "hasChatApiKey" | "hasEmbeddingApiKey">),
    hasEmbeddingApiKey: Boolean(embeddingApiKey),
    hasChatApiKey: Boolean(chatApiKey),
  };
}

export const getServersWithSecrets = async (): Promise<Server[]> => {
  return await db.select().from(servers);
};

export const getServers = async (): Promise<ServerPublic[]> => {
  const rows = await db.select(SERVER_PUBLIC_SELECT).from(servers);
  return rows.map((r) => toServerPublic(r as ServerPublicSelectRow));
};

export const getServer = async ({
  serverId,
}: {
  serverId: number | string;
}): Promise<ServerPublic | undefined> => {
  const result = await db
    .select(SERVER_PUBLIC_SELECT)
    .from(servers)
    .where(eq(servers.id, Number(serverId)))
    .limit(1);
  const row = result[0] as ServerPublicSelectRow | undefined;
  return row ? toServerPublic(row) : undefined;
};

export const getServerWithSecrets = async ({
  serverId,
}: {
  serverId: number | string;
}): Promise<Server | undefined> => {
  return await db.query.servers.findFirst({
    where: eq(servers.id, Number(serverId)),
  });
};

/**
 * Cancels all queued jobs for a server
 * @param serverId - The ID of the server
 */
const cancelServerJobs = async (serverId: number): Promise<void> => {
  const jobServerUrl =
    process.env.JOB_SERVER_URL && process.env.JOB_SERVER_URL !== "undefined"
      ? process.env.JOB_SERVER_URL
      : "http://localhost:3005";

  try {
    await fetch(`${jobServerUrl}/api/jobs/cancel-all-for-server`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverId }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // Non-critical: jobs will eventually expire or fail when server is missing
  }
};

/**
 * Deletes a server and all its associated data
 * This will cascade delete all related users, libraries, activities, sessions, and items
 * Also cancels any queued jobs for the server
 * @param serverId - The ID of the server to delete
 * @returns Promise<{ success: boolean; message: string }>
 */
export const deleteServer = async ({
  serverId,
}: {
  serverId: number;
}): Promise<{ success: boolean; message: string }> => {
  try {
    // First verify the server exists
    const serverExists = await db
      .select({ id: servers.id, name: servers.name })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    if (!serverExists.length) {
      return {
        success: false,
        message: `Delete: Server with ID ${serverId} not found`,
      };
    }

    const serverName = serverExists[0].name;

    // Cancel any queued jobs for this server before deleting
    await cancelServerJobs(serverId);

    await db.delete(servers).where(eq(servers.id, serverId));

    return {
      success: true,
      message: `Server "${serverName}" and all associated data deleted successfully`,
    };
  } catch (error) {
    console.error(`Error deleting server ${serverId}:`, error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete server",
    };
  }
};

// Embedding-related functions

export type EmbeddingProvider = "openai-compatible" | "ollama";

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  baseUrl: string;
  apiKey?: string;
  model: string;
  dimensions?: number;
}

export const saveEmbeddingConfig = async ({
  serverId,
  config,
}: {
  serverId: number;
  config: EmbeddingConfig;
}) => {
  try {
    // Build update object - only include apiKey if explicitly provided
    // This prevents accidentally wiping existing keys when other fields are updated
    // Normalize base URL by removing trailing slashes
    const normalizedBaseUrl = config.baseUrl?.replace(/\/+$/, "");

    const updateData: Partial<typeof servers.$inferInsert> = {
      embeddingProvider: config.provider,
      embeddingBaseUrl: normalizedBaseUrl,
      embeddingModel: config.model,
      embeddingDimensions: config.dimensions || 1536,
    };

    // Only update API key if a non-empty value is provided
    // Empty string or undefined means "keep existing key"
    if (config.apiKey && config.apiKey.trim().length > 0) {
      updateData.embeddingApiKey = config.apiKey;
    }

    await db.update(servers).set(updateData).where(eq(servers.id, serverId));
  } catch (error) {
    console.error(
      `Error saving embedding config for server ${serverId}:`,
      error,
    );
    throw new Error("Failed to save embedding configuration");
  }
};

export const clearEmbeddingApiKey = async ({
  serverId,
}: {
  serverId: number;
}) => {
  try {
    await db
      .update(servers)
      .set({ embeddingApiKey: null })
      .where(eq(servers.id, serverId));
  } catch (error) {
    console.error(
      `Error clearing embedding API key for server ${serverId}:`,
      error,
    );
    throw new Error("Failed to clear embedding API key");
  }
};

export const clearChatApiKey = async ({ serverId }: { serverId: number }) => {
  try {
    await db
      .update(servers)
      .set({ chatApiKey: null })
      .where(eq(servers.id, serverId));
  } catch (error) {
    console.error(`Error clearing chat API key for server ${serverId}:`, error);
    throw new Error("Failed to clear chat API key");
  }
};

export const clearEmbeddings = async ({ serverId }: { serverId: number }) => {
  try {
    // Stop any running embedding job first
    const jobServerUrl =
      process.env.JOB_SERVER_URL && process.env.JOB_SERVER_URL !== "undefined"
        ? process.env.JOB_SERVER_URL
        : "http://localhost:3005";

    try {
      await fetch(`${jobServerUrl}/api/jobs/stop-embedding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });
    } catch {
      // Non-critical: job might not be running
    }

    // Clear all embeddings for items belonging to this server
    await db
      .update(items)
      .set({ embedding: null, processed: false })
      .where(eq(items.serverId, serverId));

    // Check if any other servers still have embeddings
    const otherEmbeddings = await db
      .select({ count: count() })
      .from(items)
      .where(sql`${items.embedding} IS NOT NULL`);

    const hasOtherEmbeddings = (otherEmbeddings[0]?.count ?? 0) > 0;

    // If no embeddings remain, drop the index so it can be recreated with new dimensions
    if (!hasOtherEmbeddings) {
      await db.execute(sql`DROP INDEX IF EXISTS items_embedding_idx`);
    }

    // Clear the job server's in-memory embedding index cache
    try {
      await fetch(`${jobServerUrl}/api/jobs/clear-embedding-cache`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Non-critical: cache will be rebuilt on next check
    }
  } catch (error) {
    console.error(`Error clearing embeddings for server ${serverId}:`, error);
    throw new Error("Failed to clear embeddings");
  }
};

export interface EmbeddingProgress {
  total: number;
  processed: number;
  percentage: number;
  status: string;
  existingDimension: number | null;
}

// Get the dimension of existing embeddings for a server
export const getExistingEmbeddingDimension = async ({
  serverId,
}: {
  serverId: number;
}): Promise<number | null> => {
  try {
    // Get one item with an embedding to check its dimension
    const result = await db
      .select({ embedding: items.embedding })
      .from(items)
      .where(
        and(eq(items.serverId, serverId), sql`${items.embedding} IS NOT NULL`),
      )
      .limit(1);

    if (result.length === 0 || !result[0].embedding) {
      return null;
    }

    // The embedding is stored as an array
    const embedding = result[0].embedding as number[];
    return embedding.length;
  } catch (error) {
    console.error(
      `Error getting embedding dimension for server ${serverId}:`,
      error,
    );
    return null;
  }
};

export const getEmbeddingProgress = async ({
  serverId,
}: {
  serverId: number;
}): Promise<EmbeddingProgress> => {
  try {
    // Get total count of movies and series for this server
    const totalResult = await db
      .select({ count: count() })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverId),
          sql`${items.type} IN ('Movie', 'Series')`,
        ),
      );

    const total = totalResult[0]?.count || 0;

    // Get count of processed movies and series
    const processedResult = await db
      .select({ count: count() })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverId),
          eq(items.processed, true),
          sql`${items.type} IN ('Movie', 'Series')`,
        ),
      );

    const processed = processedResult[0]?.count || 0;

    // Check if there's an active embedding job
    const recentJob = await db
      .select()
      .from(jobResults)
      .where(
        and(
          eq(jobResults.jobName, "generate-item-embeddings"),
          sql`${jobResults.result}->>'serverId' = ${serverId.toString()}`,
        ),
      )
      .orderBy(desc(jobResults.createdAt))
      .limit(1);

    let status = "idle";
    if (recentJob.length > 0) {
      const job = recentJob[0];

      if (job.status === "processing") {
        // Check if the job has a stale heartbeat (embedding jobs can legitimately run for a long time)
        const result = job.result as { lastHeartbeat?: string };
        const lastHeartbeat = result?.lastHeartbeat
          ? new Date(result.lastHeartbeat).getTime()
          : new Date(job.createdAt).getTime();
        const heartbeatAge = Date.now() - lastHeartbeat;
        const isHeartbeatStale = heartbeatAge > 90 * 1000; // 90 seconds without heartbeat (job updates every ~30s)

        if (isHeartbeatStale) {
          console.warn(
            `[embeddings] serverId=${serverId} action=staleDetected status=markFailed heartbeatAgeMs=${heartbeatAge}`,
          );

          // Mark the stale job as failed
          await db.insert(jobResults).values({
            jobId: `cleanup-${serverId}-${Date.now()}`,
            jobName: "generate-item-embeddings",
            status: "failed",
            result: {
              serverId,
              error: "Job timed out or became stale",
              staleSince: new Date().toISOString(),
              originalJobId: job.jobId,
            },
            processingTime: null,
            error: "Job exceeded maximum processing time or lost heartbeat",
          });

          status = "failed";
        } else {
          status = "processing";
        }
      } else if (job.status === "stopped") {
        status = "stopped";
      } else if (job.status === "failed") {
        status = "failed";
      } else if (processed === total && total > 0) {
        status = "completed";
      }
    }

    const percentage = total > 0 ? (processed / total) * 100 : 0;

    // Get existing embedding dimension
    const existingDimension = await getExistingEmbeddingDimension({ serverId });

    return {
      total,
      processed,
      percentage,
      status,
      existingDimension,
    };
  } catch (error) {
    console.error(
      `Error getting embedding progress for server ${serverId}:`,
      error,
    );
    throw new Error("Failed to get embedding progress");
  }
};

// Helper function to cleanup stale embedding jobs across all servers
export const cleanupStaleEmbeddingJobs = async (): Promise<number> => {
  try {
    // Find all processing embedding jobs older than 10 minutes
    const staleJobs = await db
      .select()
      .from(jobResults)
      .where(
        and(
          eq(jobResults.jobName, "generate-item-embeddings"),
          eq(jobResults.status, "processing"),
          sql`${jobResults.createdAt} < NOW() - INTERVAL '10 minutes'`,
        ),
      );

    let cleanedCount = 0;

    for (const staleJob of staleJobs) {
      try {
        const result = staleJob.result as EmbeddingJobResult | null;
        const serverId = result?.serverId;

        if (serverId) {
          // Check if there's been recent heartbeat activity
          const lastHeartbeat = result?.lastHeartbeat
            ? new Date(result.lastHeartbeat).getTime()
            : new Date(staleJob.createdAt).getTime();
          const heartbeatAge = Date.now() - lastHeartbeat;

          // Only cleanup if no recent heartbeat (older than 2 minutes)
          if (heartbeatAge > 2 * 60 * 1000) {
            const processingTime = Math.min(
              Date.now() - new Date(staleJob.createdAt).getTime(),
              3600000,
            );

            await db
              .update(jobResults)
              .set({
                status: "failed",
                error: "Job exceeded maximum processing time without heartbeat",
                processingTime,
                result: {
                  ...result,
                  error: "Job cleanup - exceeded maximum processing time",
                  cleanedAt: new Date().toISOString(),
                  staleDuration: heartbeatAge,
                },
              })
              .where(eq(jobResults.id, staleJob.id));

            cleanedCount++;
            // Intentionally no console.log here (avoid noisy production logs)
          }
        }
      } catch (error) {
        console.error("Error cleaning up stale job:", staleJob.jobId, error);
      }
    }

    if (cleanedCount > 0) {
      // Intentionally no console.log here (avoid noisy production logs)
    }

    return cleanedCount;
  } catch (error) {
    console.error("Error during stale job cleanup:", error);
    return 0;
  }
};

export const startEmbedding = async ({ serverId }: { serverId: number }) => {
  try {
    // Verify server exists and has valid config
    const server = await getServer({ serverId });
    if (!server) {
      throw new Error("Server not found");
    }

    // Check if provider is configured
    if (!server.embeddingProvider) {
      throw new Error("Please configure an embedding provider before starting");
    }

    if (!server.embeddingBaseUrl || !server.embeddingModel) {
      throw new Error(
        "Embedding configuration incomplete. Please configure the base URL and model",
      );
    }

    // API key is optional for both providers - local providers like LM Studio don't require one

    // Check if configured dimension matches existing embeddings
    const existingDimension = await getExistingEmbeddingDimension({ serverId });
    const configuredDimension = server.embeddingDimensions || 1536;

    if (existingDimension && existingDimension !== configuredDimension) {
      throw new Error(
        `Dimension mismatch: existing embeddings have ${existingDimension} dimensions, but configured dimension is ${configuredDimension}. Please clear existing embeddings before changing dimensions.`,
      );
    }

    // Construct job server URL with proper fallback
    const jobServerUrl =
      process.env.JOB_SERVER_URL && process.env.JOB_SERVER_URL !== "undefined"
        ? process.env.JOB_SERVER_URL
        : "http://localhost:3005";

    // Queue the embedding job (this will be implemented in the job server)
    const response = await fetch(`${jobServerUrl}/api/jobs/start-embedding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ serverId }),
    });

    if (!response.ok) {
      throw new Error("Failed to start embedding job");
    }
  } catch (error) {
    console.error(`Error starting embedding for server ${serverId}:`, error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to start embedding process",
    );
  }
};

export const stopEmbedding = async ({ serverId }: { serverId: number }) => {
  try {
    // Construct job server URL with proper fallback
    const jobServerUrl =
      process.env.JOB_SERVER_URL && process.env.JOB_SERVER_URL !== "undefined"
        ? process.env.JOB_SERVER_URL
        : "http://localhost:3005";

    // Stop the embedding job (this will be implemented in the job server)
    const response = await fetch(`${jobServerUrl}/api/jobs/stop-embedding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ serverId }),
    });

    if (!response.ok) {
      throw new Error("Failed to stop embedding job");
    }
  } catch (error) {
    console.error(`Error stopping embedding for server ${serverId}:`, error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to stop embedding process",
    );
  }
};

export const toggleAutoEmbeddings = async ({
  serverId,
  enabled,
}: {
  serverId: number;
  enabled: boolean;
}) => {
  try {
    await db
      .update(servers)
      .set({ autoGenerateEmbeddings: enabled })
      .where(eq(servers.id, serverId));
  } catch (error) {
    console.error(
      `Error toggling auto embeddings for server ${serverId}:`,
      error,
    );
    throw new Error("Failed to update auto-embedding setting");
  }
};

export interface UpdateServerConnectionResult {
  success: boolean;
  message: string;
  accessToken?: string;
  userId?: string;
  username?: string;
  isAdmin?: boolean;
}

export const updateServerConnection = async ({
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
    // Validate URL format
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return {
        success: false,
        message: "URL must start with http:// or https://",
      };
    }

    // Normalize URL by removing trailing slash
    const normalizedUrl = url.endsWith("/") ? url.slice(0, -1) : url;

    // Test connection to new Jellyfin server with new API key
    try {
      const testResponse = await fetch(`${normalizedUrl}/System/Info`, {
        method: "GET",
        headers: {
          Authorization: `MediaBrowser Client="Streamystats", Token="${apiKey}"`,
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
        } else if (testResponse.status >= 500) {
          errorMessage =
            "Server error. Please check if Jellyfin server is running properly.";
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

      // Check if a different server already has this URL (unique constraint)
      const existingServer = await db
        .select({ id: servers.id, name: servers.name })
        .from(servers)
        .where(eq(servers.url, normalizedUrl))
        .limit(1);

      if (existingServer.length > 0 && existingServer[0].id !== serverId) {
        return {
          success: false,
          message: `This URL is already used by server "${existingServer[0].name}". Each server must have a unique URL.`,
        };
      }

      // Authenticate user credentials against new server
      const authResponse = await fetch(
        `${normalizedUrl}/Users/AuthenticateByName`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `MediaBrowser Client="Streamystats", Token="${apiKey}"`,
          },
          body: JSON.stringify({ Username: username, Pw: password }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!authResponse.ok) {
        return {
          success: false,
          message:
            authResponse.status === 401
              ? "Invalid username or password"
              : "Failed to authenticate user",
        };
      }

      const authData = await authResponse.json();

      // Validate authentication response structure
      if (!authData || !authData.AccessToken) {
        return {
          success: false,
          message: "Invalid authentication response from server",
        };
      }

      const accessToken = authData.AccessToken;
      const user = authData.User;

      if (!user || !user.Id) {
        return {
          success: false,
          message: "Invalid user data in authentication response",
        };
      }

      const policy = user.Policy;
      if (!policy) {
        return {
          success: false,
          message:
            "Unable to verify user permissions. User policy information is missing.",
        };
      }

      const isAdmin = policy.IsAdministrator === true;

      // Verify user is an administrator
      if (!isAdmin) {
        return {
          success: false,
          message:
            "Only administrators can update server connection settings. Please log in with an admin account.",
        };
      }

      // Update database with normalized URL, API key, and optionally name
      const updateData: Partial<typeof servers.$inferInsert> = {
        url: normalizedUrl,
        apiKey,
        updatedAt: new Date(),
      };

      if (name) {
        updateData.name = name;
      }

      if (serverInfo.Version) {
        updateData.version = serverInfo.Version;
      }

      await db.update(servers).set(updateData).where(eq(servers.id, serverId));

      return {
        success: true,
        message: "Server connection updated successfully",
        accessToken,
        userId: user.Id,
        username: user.Name,
        isAdmin,
      };
    } catch (fetchError) {
      console.error("Error connecting to Jellyfin server:", fetchError);
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
    console.error(`Error updating server connection for ${serverId}:`, error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update server connection",
    };
  }
};

// AI Chat configuration functions

export type ChatProvider = "openai-compatible" | "ollama" | "anthropic";

export interface ChatAIConfig {
  provider: ChatProvider;
  baseUrl: string;
  apiKey?: string;
  model: string;
}

export const saveChatConfig = async ({
  serverId,
  config,
}: {
  serverId: number;
  config: ChatAIConfig;
}) => {
  try {
    // Build update object - only include apiKey if explicitly provided
    // This prevents accidentally wiping existing keys when other fields are updated
    // Normalize base URL by removing trailing slashes
    const normalizedBaseUrl = config.baseUrl?.replace(/\/+$/, "");

    const updateData: Partial<typeof servers.$inferInsert> = {
      chatProvider: config.provider,
      chatBaseUrl: normalizedBaseUrl,
      chatModel: config.model,
    };

    // Only update API key if a non-empty value is provided
    // Empty string or undefined means "keep existing key"
    if (config.apiKey && config.apiKey.trim().length > 0) {
      updateData.chatApiKey = config.apiKey;
    }

    await db.update(servers).set(updateData).where(eq(servers.id, serverId));
  } catch (error) {
    console.error(`Error saving chat config for server ${serverId}:`, error);
    throw new Error("Failed to save chat configuration");
  }
};

export const getChatConfig = async ({
  serverId,
}: {
  serverId: number;
}): Promise<ChatAIConfig | null> => {
  try {
    const server = await getServerWithSecrets({ serverId });
    if (!server || !server.chatProvider || !server.chatModel) {
      return null;
    }
    return {
      provider: server.chatProvider as ChatProvider,
      baseUrl: server.chatBaseUrl || "",
      apiKey: server.chatApiKey || undefined,
      model: server.chatModel,
    };
  } catch (error) {
    console.error(`Error getting chat config for server ${serverId}:`, error);
    return null;
  }
};

export const clearChatConfig = async ({ serverId }: { serverId: number }) => {
  try {
    await db
      .update(servers)
      .set({
        chatProvider: null,
        chatBaseUrl: null,
        chatApiKey: null,
        chatModel: null,
      })
      .where(eq(servers.id, serverId));
  } catch (error) {
    console.error(`Error clearing chat config for server ${serverId}:`, error);
    throw new Error("Failed to clear chat configuration");
  }
};

export const testChatConnection = async ({
  config,
}: {
  config: ChatAIConfig;
}): Promise<{ success: boolean; message: string }> => {
  try {
    if (config.provider === "anthropic") {
      const response = await fetch(
        `${config.baseUrl || "https://api.anthropic.com"}/v1/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey || "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 10,
            messages: [{ role: "user", content: "Hi" }],
          }),
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        return { success: false, message: `Anthropic API error: ${error}` };
      }
      return { success: true, message: "Connection successful" };
    }

    if (config.provider === "ollama") {
      // Strip /v1 suffix if present since /api/tags is at the Ollama root
      let ollamaBaseUrl = config.baseUrl || "http://localhost:11434";
      if (ollamaBaseUrl.endsWith("/v1")) {
        ollamaBaseUrl = ollamaBaseUrl.slice(0, -3);
      }

      const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { success: false, message: "Failed to connect to Ollama" };
      }

      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };
      const models = data.models?.map((m) => m.name) || [];
      if (!models.some((m: string) => m.includes(config.model))) {
        return {
          success: false,
          message: `Model "${config.model}" not found. Available: ${models.join(
            ", ",
          )}`,
        };
      }
      return { success: true, message: "Connection successful" };
    }

    const response = await fetch(`${config.baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey || ""}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { success: false, message: "Failed to connect to API" };
    }
    return { success: true, message: "Connection successful" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
};
