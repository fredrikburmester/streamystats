"use client";

import { fetch } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface JobStatusResponse {
  success: boolean;
  timestamp: string;
  uptime: number;
  queueStats: {
    fetchExternalData: number;
    batchProcessPosts: number;
    customProcessing: number;
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
  jobStatusMap: {
    [key: string]: "processing" | "completed" | "failed";
  };
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
      syncError?: string;
      lastSyncStarted?: string;
      lastSyncCompleted?: string;
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
    id: number;
    jobName: string;
    status: string;
    createdAt: string;
    error?: string;
    processingTime?: number;
  }>;
  systemHealth: {
    overall: "healthy" | "warning" | "unhealthy";
    issues: string[];
    warnings: string[];
  };
}

async function fetchJobStatus(): Promise<JobStatusResponse> {
  const response = await fetch("/api/jobs/status");

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

interface JobStatusMonitorProps {
  refreshInterval?: number;
}

export function JobStatusMonitor({
  refreshInterval = 5000,
}: JobStatusMonitorProps) {
  const previousDataRef = useRef<JobStatusResponse | null>(null);
  const activeToastsRef = useRef<Set<string>>(new Set());
  const params = useParams();
  const serverId = params.id ? Number(params.id) : undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["jobStatus"],
    queryFn: fetchJobStatus,
    refetchInterval: refreshInterval,
    retry: 2,
    retryDelay: 5000,
  });

  const [activeToasts, setActiveToasts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (data?.jobStatusMap) {
      // Check all processing jobs
      Object.entries(data.jobStatusMap).forEach(([jobName, status]) => {
        if (
          status === "processing" &&
          !data.jobStatusMap[`${jobName}-completed`]
        ) {
          if (!activeToasts.has(jobName)) {
            toast.loading(`Processing ${jobName.replace(/-/g, " ")}...`);
            setActiveToasts((prev) => new Set(prev).add(jobName));
          }
        }
      });
    }
  }, [data]);

  // This component now only manages toasts, no JSX rendering
  return null;
}
