import type { Job } from "pg-boss";

export type JobStatus = "processing" | "completed" | "failed";

// Job data types for type-safe job handlers
export interface AddServerJobData {
  serverUrl: string;
  apiKey: string;
  name: string;
  localAddress?: string;
}

export interface EmbeddingJobData {
  serverId: number;
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  dimensions?: number;
  jobId?: string;
  batchSize?: number;
}

export interface ServerIdJobData {
  serverId: number;
}

// Generic pg-boss job type with typed data (v12 API)
export type PgBossJob<T> = Job<T>;

export type ServerJobState =
  | "running"
  | "queued"
  | "scheduled"
  | "failed"
  | "cancelled"
  | "stopped";

export type ServerJobStatusItem = {
  key: string;
  label: string;
  state: ServerJobState;
  updatedAt: string;
  activeSince?: string;
  scheduledFor?: string;
  jobId?: string;
  lastError?: string;
};

export type ServerJobStatusResponse = {
  success: boolean;
  timestamp: string;
  serverId: number;
  jobs: ServerJobStatusItem[];
};

export interface JobStatusInfo {
  jobId: string;
  status: JobStatus;
  jobName: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  processingTime?: number;
  error?: string | null;
  data?: Record<string, unknown>;
}

export interface JobStatusSummary {
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export interface JobStatusMapResponse {
  success: true;
  timestamp: string;
  summary: JobStatusSummary;
  jobs: {
    all: JobStatusInfo[];
    byStatus: {
      processing: JobStatusInfo[];
      completed: JobStatusInfo[];
      failed: JobStatusInfo[];
    };
  };
}

export interface ServerStatusResponse {
  success: true;
  timestamp: string;
  uptime: number;
  queueStats: {
    addServer: number;
    generateItemEmbeddings: number;
    jellyfinFullSync: number;
    jellyfinUsersSync: number;
    jellyfinLibrariesSync: number;
    jellyfinItemsSync: number;
    jellyfinActivitiesSync: number;
    jellyfinRecentItemsSync: number;
    jellyfinRecentActivitiesSync: number;
    jellyfinPeopleSync: number;
    jellyfinRatingsSync: number;
    totalQueued: number;
    standardJobsQueued: number;
    jellyfinJobsQueued: number;
  };
  // Simple job status map: job-name -> status
  jobStatusMap: Record<string, JobStatus>;
  servers: {
    total: number;
    byStatus: {
      pending: number;
      syncing: number;
      completed: number;
      failed: number;
    };
    list: Array<{
      id: number;
      name: string;
      url: string;
      syncStatus: string;
      syncProgress: string;
      syncError?: string | null;
      lastSyncStarted?: Date | null;
      lastSyncCompleted?: Date | null;
      isHealthy: boolean;
      needsAttention: boolean;
    }>;
  };
  scheduler: {
    enabled: boolean;
    activitySyncInterval: string;
    recentItemsSyncInterval: string;
    runningTasks: string[];
    healthCheck: boolean;
  };
  sessionPoller: {
    enabled: boolean;
    intervalMs: number;
    isRunning: boolean;
    trackedServers: number;
    totalTrackedSessions: number;
    healthCheck: boolean;
  };
  recentResults: Array<{
    id: string;
    jobName: string;
    status: string;
    createdAt: Date;
    error?: string | null;
    processingTime?: number | null;
  }>;
  systemHealth: {
    overall: "healthy" | "warning" | "unhealthy";
    issues: string[];
    warnings: string[];
  };
}
