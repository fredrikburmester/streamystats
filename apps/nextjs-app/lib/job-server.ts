import "server-only";

import type { Server } from "@streamystats/database";

/**
 * Client for the job-server HTTP API.
 *
 * This module is the only place in the Next.js app that knows how to reach
 * the job-server: base-URL resolution, request encoding, timeouts, and error
 * decoding all live here. Callers use the semantic operations on `jobServer`
 * and never build job-server URLs themselves.
 *
 * All operations throw `JobServerError` when the job-server is unreachable
 * or responds with a non-2xx status.
 */

const DEFAULT_JOB_SERVER_URL = "http://localhost:3005";

/** Raised for any failed job-server request. `status` is unset when the server was unreachable. */
export class JobServerError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "JobServerError";
    this.status = status;
  }
}

function baseUrl(): string {
  const url = process.env.JOB_SERVER_URL;
  // Some deployments pass the literal string "undefined" when the var is unset
  return url && url !== "undefined" ? url : DEFAULT_JOB_SERVER_URL;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Abort the request after this many milliseconds. No timeout when omitted. */
  timeoutMs?: number;
  cache?: RequestCache;
}

async function request(
  path: string,
  options: RequestOptions,
): Promise<Response> {
  const { method = "GET", body, timeoutMs, cache } = options;
  try {
    return await fetch(`${baseUrl()}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal:
        timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs),
      cache,
    });
  } catch (error) {
    throw new JobServerError(
      error instanceof Error ? error.message : "Failed to reach job server",
    );
  }
}

async function errorMessage(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}: ${response.statusText}`;
  try {
    const data = (await response.json()) as {
      error?: string;
      details?: string;
      message?: string;
    };
    return data.error || data.details || data.message || fallback;
  } catch {
    return fallback;
  }
}

async function requestJson<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await request(path, options);
  if (!response.ok) {
    throw new JobServerError(await errorMessage(response), response.status);
  }
  return (await response.json()) as T;
}

export interface CreateServerPayload {
  name: string;
  url: string;
  apiKey: string;
  localAddress?: string;
  autoGenerateEmbeddings?: boolean;
  embeddingProvider?: "openai-compatible" | "ollama";
  embeddingBaseUrl?: string;
  embeddingApiKey?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
}

export interface CreateServerResult {
  success: boolean;
  server: Server;
  syncJobId: string;
  message: string;
}

export interface TriggerJobResult {
  success?: boolean;
  message?: string;
  jobId?: string;
}

export interface CleanupInferredSessionsResult {
  message?: string;
  deletedCount?: number;
}

/** A single job's schedule configuration as reported by the job-server. */
export interface JobConfigItem {
  jobKey: string;
  label: string;
  description: string;
  category: string;
  type: "cron" | "interval";
  // For cron-based jobs
  defaultCron?: string;
  cronExpression?: string | null;
  // For interval-based jobs
  defaultInterval?: number;
  intervalSeconds?: number | null;
  enabled: boolean;
  isUsingDefault: boolean;
}

export interface JobConfigsResult {
  serverId: number;
  configs: JobConfigItem[];
}

export interface UpdatedJobConfig {
  jobKey: string;
  label: string;
  cronExpression: string | null;
  enabled: boolean;
  isUsingDefault: boolean;
}

export interface ResetJobConfig {
  jobKey: string;
  label: string;
  cronExpression: null;
  enabled: true;
  isUsingDefault: true;
  defaultCron: string;
}

export interface UpdateJobConfigPayload {
  cronExpression?: string | null;
  intervalSeconds?: number | null;
  enabled?: boolean;
}

export const jobServer = {
  createServer(payload: CreateServerPayload): Promise<CreateServerResult> {
    return requestJson("/api/jobs/create-server", {
      method: "POST",
      body: payload,
    });
  },

  getSyncStatus(serverId: number | string): Promise<unknown> {
    return requestJson(`/api/jobs/servers/${serverId}/sync-status`);
  },

  getJobStatus(serverId: number | string): Promise<unknown> {
    return requestJson(`/api/jobs/servers/${serverId}/status`);
  },

  async cancelAllJobs(serverId: number): Promise<void> {
    await requestJson("/api/jobs/cancel-all-for-server", {
      method: "POST",
      body: { serverId },
      timeoutMs: 10000,
    });
  },

  triggerFullSync(serverId: number): Promise<unknown> {
    return requestJson("/api/jobs/scheduler/trigger-full-sync", {
      method: "POST",
      body: { serverId },
    });
  },

  triggerPeopleSync(serverId: number): Promise<unknown> {
    return requestJson("/api/jobs/scheduler/trigger-people-sync", {
      method: "POST",
      body: { serverId },
    });
  },

  triggerLibrarySync(serverId: number, libraryId: string): Promise<unknown> {
    return requestJson("/api/jobs/scheduler/trigger-library-sync", {
      method: "POST",
      body: { serverId, libraryId },
    });
  },

  triggerSecuritySync(serverId: number | string): Promise<unknown> {
    return requestJson(`/api/servers/${serverId}/security/sync`, {
      method: "POST",
    });
  },

  cleanupDeletedItems(serverId: number): Promise<unknown> {
    return requestJson("/api/jobs/cleanup-deleted-items", {
      method: "POST",
      body: { serverId },
    });
  },

  async startEmbedding(serverId: number): Promise<void> {
    await requestJson("/api/jobs/start-embedding", {
      method: "POST",
      body: { serverId },
    });
  },

  async stopEmbedding(serverId: number): Promise<void> {
    await requestJson("/api/jobs/stop-embedding", {
      method: "POST",
      body: { serverId },
    });
  },

  async clearEmbeddingCache(): Promise<void> {
    await requestJson("/api/jobs/clear-embedding-cache", { method: "POST" });
  },

  triggerInferWatchtime(payload: {
    serverId: number;
    userId?: string;
    triggeredBy: string;
    isAdmin: boolean;
  }): Promise<TriggerJobResult> {
    return requestJson("/api/jobs/infer-watchtime/trigger", {
      method: "POST",
      body: payload,
      timeoutMs: 10000,
    });
  },

  cleanupInferredSessions(payload: {
    serverId: number;
    userId?: string;
  }): Promise<CleanupInferredSessionsResult> {
    return requestJson("/api/jobs/infer-watchtime/cleanup", {
      method: "DELETE",
      body: payload,
      timeoutMs: 30000,
    });
  },

  async triggerGeolocationBackfill(serverId: number): Promise<void> {
    await requestJson(`/api/servers/${serverId}/locations/backfill`, {
      method: "POST",
    });
  },

  async triggerFingerprintRecalculation(serverId: number): Promise<void> {
    await requestJson(`/api/servers/${serverId}/fingerprints/recalculate`, {
      method: "POST",
    });
  },

  getJobConfigs(serverId: number): Promise<JobConfigsResult> {
    return requestJson(`/api/jobs/servers/${serverId}/config`, {
      cache: "no-store",
    });
  },

  updateJobConfig(payload: {
    serverId: number;
    jobKey: string;
    config: UpdateJobConfigPayload;
  }): Promise<{ config: UpdatedJobConfig }> {
    return requestJson(
      `/api/jobs/servers/${payload.serverId}/config/${payload.jobKey}`,
      { method: "PUT", body: payload.config },
    );
  },

  resetJobConfig(payload: {
    serverId: number;
    jobKey: string;
  }): Promise<{ config: ResetJobConfig }> {
    return requestJson(
      `/api/jobs/servers/${payload.serverId}/config/${payload.jobKey}`,
      { method: "DELETE" },
    );
  },

  /**
   * Open the job-server SSE event stream. Returns the raw upstream response
   * so callers can pipe the stream through; no timeout is applied.
   */
  openEventStream(since?: string | null): Promise<Response> {
    const path = since
      ? `/api/events?since=${encodeURIComponent(since)}`
      : "/api/events";
    return fetch(`${baseUrl()}${path}`, {
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
    });
  },
};
