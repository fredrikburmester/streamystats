"use server";

import { db, servers, type Server } from "@streamystats/database";

interface CreateServerRequest {
  name: string;
  url: string;
  apiKey: string;
  localAddress?: string;
}

interface CreateServerSuccessResponse {
  success: boolean;
  server: Server;
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
  serverData: CreateServerRequest
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

    const result: CreateServerSuccessResponse = await response.json();
    return result;
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
      `${jobServerUrl}/api/jobs/servers/${serverId}/sync-status`
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
        : "Failed to get server sync status"
    );
  }
}

/**
 * Gets all servers from the database
 */
export async function getServers(): Promise<Server[]> {
  try {
    return await db.select().from(servers);
  } catch (error) {
    console.error("Error fetching servers:", error);
    throw new Error("Failed to fetch servers from database");
  }
}

/**
 * Polls the server sync status until it's complete or fails
 * Returns a promise that resolves when the sync is complete
 */
export async function pollServerSetupStatus(
  serverId: number,
  maxAttempts: number = 30,
  intervalMs: number = 2000
): Promise<{ success: boolean; status: string }> {
  const status = await getServerSyncStatus(serverId);
  return status;
}
