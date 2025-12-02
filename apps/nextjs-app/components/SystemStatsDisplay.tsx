"use client";

import { fetch } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Eye,
  Pause,
  Play,
  Server,
  Timer,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

interface SystemStatsResponse {
  success: boolean;
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
  jobStatus: {
    note: string;
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

async function fetchSystemStats(): Promise<SystemStatsResponse> {
  const response = await fetch("/api/jobs/status");
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatProcessingTime(ms: number): string {
  if (ms > 60000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms > 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "text-green-600 bg-green-50 border-green-200";
    case "syncing":
      return "text-blue-600 bg-blue-50 border-blue-200";
    case "pending":
      return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "failed":
      return "text-red-600 bg-red-50 border-red-200";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

function getHealthColor(health: string): string {
  switch (health) {
    case "healthy":
      return "text-green-600 bg-green-50 border-green-200";
    case "warning":
      return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "unhealthy":
      return "text-red-600 bg-red-50 border-red-200";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

export function SystemStatsDisplay() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["systemStats"],
    queryFn: fetchSystemStats,
    refetchInterval: 5000,
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* System Overview Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Server Status Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Skeleton className="h-5 w-5 mr-2" />
              <Skeleton className="h-6 w-32" />
            </CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-64" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-8 w-8 mx-auto mb-2" />
                  <Skeleton className="h-3 w-16 mx-auto" />
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Skeleton className="w-2 h-2 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Queue Statistics Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Skeleton className="h-5 w-5 mr-2" />
              <Skeleton className="h-6 w-40" />
            </CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-56" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <div className="space-y-1 text-xs">
                    {[...Array(i === 0 ? 1 : 4)].map((_, j) => (
                      <div key={j} className="flex justify-between">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-4" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Background Services Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Skeleton className="h-5 w-5 mr-2" />
                  <Skeleton className="h-6 w-32" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Job Results Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Skeleton className="h-5 w-5 mr-2" />
              <Skeleton className="h-6 w-36" />
            </CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-48" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-4 w-4" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24 mb-1" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center text-red-600">
            <XCircle className="h-5 w-5 mr-2" />
            <span>Failed to load system stats</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge className={getHealthColor(data.systemHealth.overall)}>
                {data.systemHealth.overall}
              </Badge>
              {data.systemHealth.overall === "healthy" && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              {data.systemHealth.overall === "warning" && (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              )}
              {data.systemHealth.overall === "unhealthy" && (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            {data.systemHealth.issues.length > 0 && (
              <div className="mt-2 text-xs text-red-600">
                Issues: {data.systemHealth.issues.join(", ")}
              </div>
            )}
            {data.systemHealth.warnings.length > 0 && (
              <div className="mt-2 text-xs text-yellow-600">
                Warnings: {data.systemHealth.warnings.join(", ")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatUptime(data.uptime)}
            </div>
            <p className="text-xs text-muted-foreground">
              Since{" "}
              {new Date(Date.now() - data.uptime * 1000).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.queueStats.totalQueued}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.queueStats.standardJobsQueued} standard,{" "}
              {data.queueStats.jellyfinJobsQueued} jellyfin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Server Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Server className="h-5 w-5 mr-2" />
            Servers ({data.servers.total})
          </CardTitle>
          <CardDescription>
            Media server connection status and sync progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {data.servers.byStatus.completed}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {data.servers.byStatus.syncing}
              </div>
              <div className="text-xs text-muted-foreground">Syncing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {data.servers.byStatus.pending}
              </div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {data.servers.byStatus.failed}
              </div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-3">
            {data.servers.list.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      server.isHealthy ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <div>
                    <div className="font-medium">{server.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {server.url}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(server.syncStatus)}>
                    {server.syncStatus}
                  </Badge>
                  {server.syncProgress &&
                    server.syncProgress !== "completed" && (
                      <Badge variant="outline" className="text-xs">
                        {server.syncProgress}
                      </Badge>
                    )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Queue Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="h-5 w-5 mr-2" />
            Job Queue Statistics
          </CardTitle>
          <CardDescription>
            Current job queue status across all worker types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Standard Jobs</h4>
              <div className="space-y-1 text-xs">
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm">Server Jobs</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Sync Server Data</span>
                  <span>{data.queueStats.syncServerData}</span>
                </div>
                <div className="flex justify-between">
                  <span>Add Server</span>
                  <span>{data.queueStats.addServer}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sequential Sync</span>
                  <span>{data.queueStats.sequentialServerSync}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm">Jellyfin Jobs</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Full Sync</span>
                  <span>{data.queueStats.jellyfinFullSync}</span>
                </div>
                <div className="flex justify-between">
                  <span>Users Sync</span>
                  <span>{data.queueStats.jellyfinUsersSync}</span>
                </div>
                <div className="flex justify-between">
                  <span>Libraries Sync</span>
                  <span>{data.queueStats.jellyfinLibrariesSync}</span>
                </div>
                <div className="flex justify-between">
                  <span>Items Sync</span>
                  <span>{data.queueStats.jellyfinItemsSync}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm">Activity Jobs</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Activities Sync</span>
                  <span>{data.queueStats.jellyfinActivitiesSync}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recent Items</span>
                  <span>{data.queueStats.jellyfinRecentItemsSync}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recent Activities</span>
                  <span>{data.queueStats.jellyfinRecentActivitiesSync}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Background Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Timer className="h-5 w-5 mr-2" />
              Scheduler Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status</span>
                <div className="flex items-center space-x-2">
                  {data.scheduler.enabled ? (
                    <Play className="h-4 w-4 text-green-600" />
                  ) : (
                    <Pause className="h-4 w-4 text-red-600" />
                  )}
                  <Badge
                    className={
                      data.scheduler.enabled
                        ? "text-green-600 bg-green-50"
                        : "text-red-600 bg-red-50"
                    }
                  >
                    {data.scheduler.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Activity Sync</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {data.scheduler.activitySyncInterval}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Recent Items</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {data.scheduler.recentItemsSyncInterval}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Running Tasks</span>
                <span className="text-xs">
                  {data.scheduler.runningTasks.length}
                </span>
              </div>
              {data.scheduler.runningTasks.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {data.scheduler.runningTasks.join(", ")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="h-5 w-5 mr-2" />
              Session Poller
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status</span>
                <div className="flex items-center space-x-2">
                  {data.sessionPoller.enabled &&
                  data.sessionPoller.isRunning ? (
                    <Play className="h-4 w-4 text-green-600" />
                  ) : (
                    <Pause className="h-4 w-4 text-red-600" />
                  )}
                  <Badge
                    className={
                      data.sessionPoller.enabled && data.sessionPoller.isRunning
                        ? "text-green-600 bg-green-50"
                        : "text-red-600 bg-red-50"
                    }
                  >
                    {data.sessionPoller.enabled && data.sessionPoller.isRunning
                      ? "Running"
                      : "Stopped"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Interval</span>
                <span className="text-xs">
                  {data.sessionPoller.intervalMs}ms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Tracked Servers</span>
                <span className="text-xs">
                  {data.sessionPoller.trackedServers}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Sessions</span>
                <span className="text-xs">
                  {data.sessionPoller.totalTrackedSessions}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Job Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Recent Job Results
          </CardTitle>
          <CardDescription>
            Latest completed and failed job executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.recentResults.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {result.status === "completed" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <div>
                    <div className="font-medium text-sm">
                      {result.jobName
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (str) => str.toUpperCase())}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(result.createdAt).toLocaleString()}
                    </div>
                    {result.error && (
                      <div className="text-xs text-red-600 mt-1">
                        {result.error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(result.status)}>
                    {result.status}
                  </Badge>
                  {result.processingTime && (
                    <span className="text-xs text-muted-foreground">
                      {formatProcessingTime(result.processingTime)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
