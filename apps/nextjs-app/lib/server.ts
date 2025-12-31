"use server";

import type { Server } from "@streamystats/database";
import type { ServerPublic } from "@/lib/types";

interface CreateServerRequest {
  name: string;
  url: string;
  internalUrl?: string;
  apiKey: string;
  localAddress?: string;
  autoGenerateEmbeddings?: boolean;
  embeddingProvider?: "openai-compatible" | "ollama";
  embeddingBaseUrl?: string;
  embeddingApiKey?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
}

interface CreateServerSuccessResponse {
  success: boolean;
  server: ServerPublic;
  syncJobId: string;
  message: string;
}

interface CreateServerErrorResponse {
  success: false;
  error?: string;
  details?: string;
}

/**
 * Creates a new server by calling the job-server's create-server endpoint
 * This will validate the connection, create the server record, and start the sync process
 */
export async function createServer(
  serverData: CreateServerRequest,
): Promise<CreateServerSuccessResponse | CreateServerErrorResponse> {
  const jobServerUrl =
    process.env.JOB_SERVER_URL && process.env.JOB_SERVER_URL !== "undefined"
      ? process.env.JOB_SERVER_URL
      : "http://localhost:3005";

  try {
    const response = await fetch(`${jobServerUrl}/api/jobs/create-server`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serverData),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorData: CreateServerErrorResponse = await response.json();
        errorMessage = errorData.error || errorData.details || errorMessage;
      } catch (parseError) {
        // If we can't parse the error response, use the status text
        console.warn("Failed to parse error response:", parseError);
      }

      return {
        success: false,
        details: errorMessage,
      };
    }

    const result = (await response.json()) as {
      success: boolean;
      server: Server;
      syncJobId: string;
      message: string;
    };

    const {
      apiKey: _apiKey,
      embeddingApiKey,
      chatApiKey,
      ...rest
    } = result.server;

    return {
      success: result.success,
      syncJobId: result.syncJobId,
      message: result.message,
      server: {
        ...(rest as Omit<ServerPublic, "hasChatApiKey" | "hasEmbeddingApiKey">),
        hasEmbeddingApiKey: Boolean(embeddingApiKey),
        hasChatApiKey: Boolean(chatApiKey),
      },
    };
  } catch (error) {
    console.error("Error creating server:", error);
    return {
      success: false,
      details:
        "Failed to create server. Please check your connection and try again.",
    };
  }
}

/**
 * Gets the sync status of a server from the job-server
 */
export async function getServerSyncStatus(serverId: number) {
  const jobServerUrl =
    process.env.JOB_SERVER_URL && process.env.JOB_SERVER_URL !== "undefined"
      ? process.env.JOB_SERVER_URL
      : "http://localhost:3005";

  try {
    const response = await fetch(
      `${jobServerUrl}/api/jobs/servers/${serverId}/sync-status`,
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting server sync status:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to get server sync status",
    );
  }
}

/**
 * Polls the server sync status until it's complete or fails
 * Returns a promise that resolves when the sync is complete
 */
export async function pollServerSetupStatus(
  serverId: number,
  _maxAttempts = 30,
  _intervalMs = 2000,
): Promise<{ success: boolean; status: string }> {
  const status = await getServerSyncStatus(serverId);
  return status;
}
