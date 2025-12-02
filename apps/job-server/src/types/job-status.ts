export type JobStatus = "processing" | "completed" | "failed";

export interface JobStatusInfo {
  jobId: string;
  status: JobStatus;
  jobName: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  processingTime?: number;
  error?: string | null;
  data?: any;
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
    syncServerData: number;
    addServer: number;
    sequentialServerSync: number;
    jellyfinFullSync: number;
    jellyfinUsersSync: number;
    jellyfinLibrariesSync: number;
    jellyfinItemsSync: number;
    jellyfinActivitiesSync: number;
    jellyfinRecentItemsSync: number;
    jellyfinRecentActivitiesSync: number;
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
