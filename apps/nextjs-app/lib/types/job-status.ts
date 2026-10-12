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

// Maps SSE jobName to status endpoint job key
export const JOB_NAME_TO_KEY: Record<string, string> = {
  "jellyfin-full-sync": "jellyfin-full-sync",
  "jellyfin-users-sync": "jellyfin-users-sync",
  "jellyfin-libraries-sync": "jellyfin-libraries-sync",
  "jellyfin-items-sync": "jellyfin-items-sync",
  "jellyfin-activities-sync": "jellyfin-activities-sync",
  "jellyfin-recent-items-sync": "jellyfin-recent-items-sync",
  "jellyfin-recent-activities-sync": "jellyfin-recent-activities-sync",
  "jellyfin-people-sync": "jellyfin-people-sync",
  "jellyfin-ratings-sync": "jellyfin-ratings-sync",
  "generate-item-embeddings": "generate-item-embeddings",
};
