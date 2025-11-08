"use server";

import {
  db,
  servers,
  users,
  items,
  sessions,
  activities,
  libraries,
  jobResults,
} from "@streamystats/database";
import { eq, sql, and, count, desc } from "drizzle-orm";

import { Server } from "@streamystats/database/schema";

export const getServers = async (): Promise<Server[]> => {
  return await db.select().from(servers);
};

export const getServer = async ({
  serverId
}: {
  serverId: number | string;
}): Promise<Server | undefined> => {
  return await db.query.servers.findFirst({
    where: eq(servers.id, Number(serverId)),
  });
};

/**
 * Deletes a server and all its associated data
 * This will cascade delete all related users, libraries, activities, sessions, and items
 * @param serverId - The ID of the server to delete
 * @returns Promise<{ success: boolean; message: string }>
 */
export const deleteServer = async ({
  serverId
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

export const saveOpenAIKey = async ({
  serverId,
  apiKey
}: {
  serverId: number;
  apiKey: string;
}) => {
  try {
    await db
      .update(servers)
      .set({ openAiApiToken: apiKey })
      .where(eq(servers.id, serverId));
  } catch (error) {
    console.error(`Error saving OpenAI key for server ${serverId}:`, error);
    throw new Error("Failed to save OpenAI API key");
  }
};

export const saveOllamaConfig = async ({
  serverId,
  config
}: {
  serverId: number;
  config: {
    ollama_api_token?: string;
    ollama_base_url: string;
    ollama_model: string;
  };
}) => {
  try {
    await db
      .update(servers)
      .set({
        ollamaApiToken: config.ollama_api_token || null,
        ollamaBaseUrl: config.ollama_base_url,
        ollamaModel: config.ollama_model,
      })
      .where(eq(servers.id, serverId));
  } catch (error) {
    console.error(`Error saving Ollama config for server ${serverId}:`, error);
    throw new Error("Failed to save Ollama configuration");
  }
};

export const saveEmbeddingProvider = async ({
  serverId,
  provider
}: {
  serverId: number;
  provider: "openai" | "ollama";
}) => {
  try {
    await db
      .update(servers)
      .set({ embeddingProvider: provider })
      .where(eq(servers.id, serverId));
  } catch (error) {
    console.error(
      `Error saving embedding provider for server ${serverId}:`,
      error
    );
    throw new Error("Failed to save embedding provider");
  }
};

export const clearEmbeddings = async ({
  serverId
}: {
  serverId: number;
}) => {
  try {
    // Clear all embeddings for items belonging to this server
    await db
      .update(items)
      .set({ embedding: null, processed: false })
      .where(eq(items.serverId, serverId));
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
}

export const getEmbeddingProgress = async ({
  serverId
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
          sql`${items.type} IN ('Movie', 'Series')`
        )
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
          sql`${items.type} IN ('Movie', 'Series')`
        )
      );

    const processed = processedResult[0]?.count || 0;

    // Check if there's an active embedding job
    const recentJob = await db
      .select()
      .from(jobResults)
      .where(
        and(
          eq(jobResults.jobName, "generate-item-embeddings"),
          sql`${jobResults.result}->>'serverId' = ${serverId.toString()}`
        )
      )
      .orderBy(desc(jobResults.createdAt))
      .limit(1);

    let status = "idle";
    if (recentJob.length > 0) {
      const job = recentJob[0];
      const jobAge = Date.now() - new Date(job.createdAt).getTime();
      const isStale = jobAge > 10 * 60 * 1000; // 10 minutes

      if (job.status === "processing") {
        // Check if the job has been processing for too long without heartbeat
        const result = job.result as { lastHeartbeat: string };
        const lastHeartbeat = result?.lastHeartbeat
          ? new Date(result.lastHeartbeat).getTime()
          : new Date(job.createdAt).getTime();
        const heartbeatAge = Date.now() - lastHeartbeat;
        const isHeartbeatStale = heartbeatAge > 2 * 60 * 1000; // 2 minutes without heartbeat

        if (isStale || isHeartbeatStale) {
          console.warn(
            `Detected stale embedding job for server ${serverId}, marking as failed`
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
            processingTime: jobAge,
            error: "Job exceeded maximum processing time or lost heartbeat",
          });

          status = "failed";
        } else {
          status = "processing";
        }
      } else if (job.status === "failed") {
        status = "failed";
      } else if (processed === total && total > 0) {
        status = "completed";
      }
    }

    const percentage = total > 0 ? (processed / total) * 100 : 0;

    return {
      total,
      processed,
      percentage,
      status,
    };
  } catch (error) {
    console.error(
      `Error getting embedding progress for server ${serverId}:`,
      error
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
          sql`${jobResults.createdAt} < NOW() - INTERVAL '10 minutes'`
        )
      );

    let cleanedCount = 0;

    for (const staleJob of staleJobs) {
      try {
        const result = staleJob.result as any;
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
              3600000
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
            console.log(
              `Cleaned up stale embedding job for server ${serverId}`
            );
          }
        }
      } catch (error) {
        console.error("Error cleaning up stale job:", staleJob.jobId, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} stale embedding jobs`);
    }

    return cleanedCount;
  } catch (error) {
    console.error("Error during stale job cleanup:", error);
    return 0;
  }
};

export const startEmbedding = async ({
  serverId
}: {
  serverId: number;
}) => {
  try {
    // Verify server exists and has valid config
    const server = await getServer({ serverId });
    if (!server) {
      throw new Error("Server not found");
    }

    // Check if provider is configured
    if (!server.embeddingProvider) {
      throw new Error(
        "Please select an embedding provider (OpenAI or Ollama) before starting the embedding process"
      );
    }

    if (server.embeddingProvider === "openai" && !server.openAiApiToken) {
      throw new Error(
        "OpenAI API key not configured. Please add your API key before starting"
      );
    }

    if (
      server.embeddingProvider === "ollama" &&
      (!server.ollamaBaseUrl || !server.ollamaModel)
    ) {
      throw new Error(
        "Ollama configuration incomplete. Please configure the base URL and model before starting"
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

    // Log job start
    await db.insert(jobResults).values({
      jobId: `embedding-${serverId}-${Date.now()}`,
      jobName: "generate-item-embeddings",
      status: "processing",
      result: { serverId, startedAt: new Date().toISOString() },
      processingTime: 0,
    });
  } catch (error) {
    console.error(`Error starting embedding for server ${serverId}:`, error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to start embedding process"
    );
  }
};

export const stopEmbedding = async ({
  serverId
}: {
  serverId: number;
}) => {
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

    // Update job status
    await db.insert(jobResults).values({
      jobId: `embedding-stop-${serverId}-${Date.now()}`,
      jobName: "generate-item-embeddings",
      status: "completed",
      result: { serverId, stoppedAt: new Date().toISOString(), stopped: true },
      processingTime: 0,
    });
  } catch (error) {
    console.error(`Error stopping embedding for server ${serverId}:`, error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to stop embedding process"
    );
  }
};

export const toggleAutoEmbeddings = async ({
  serverId,
  enabled
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
      error
    );
    throw new Error("Failed to update auto-embedding setting");
  }
};
