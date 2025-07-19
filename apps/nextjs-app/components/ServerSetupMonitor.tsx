"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Clock,
  Server,
  RefreshCw,
  XCircle,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

interface ServerSyncStatus {
  success: boolean;
  server: {
    id: number;
    name: string;
    syncStatus: string;
    syncProgress: string;
    syncError?: string;
    lastSyncStarted?: string;
    lastSyncCompleted?: string;
    progressPercentage: number;
    isReady: boolean;
    canRedirect: boolean;
  };
}
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

async function fetchServerSyncStatus(
  serverId: number
): Promise<ServerSyncStatus> {
  const response = await fetch(`${basePath}/api/jobs/servers/${serverId}/sync-status`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

function getSyncStepDescription(progress: string): string {
  switch (progress) {
    case "not_started":
      return "Preparing to sync...";
    case "users":
      return "Syncing users and permissions...";
    case "libraries":
      return "Syncing media libraries...";
    case "items":
      return "Syncing media items (this may take a while)...";
    case "activities":
      return "Syncing activity logs...";
    case "completed":
      return "Sync completed successfully!";
    default:
      return "Processing...";
  }
}

function getStatusIcon(status: string, progress: string) {
  if (status === "failed") {
    return <XCircle className="h-5 w-5 text-red-500" />;
  }
  if (status === "completed" && progress === "completed") {
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  }
  if (status === "syncing") {
    return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
  }
  return <Clock className="h-5 w-5 text-yellow-500" />;
}

interface ServerSetupMonitorProps {
  serverId: number;
  serverName: string;
  onComplete?: () => void;
  showRedirectButton?: boolean;
}

export function ServerSetupMonitor({
  serverId,
  serverName,
  onComplete,
  showRedirectButton = true,
}: ServerSetupMonitorProps) {
  const router = useRouter();

  const { data, isLoading, error, isError } = useQuery({
    queryKey: ["serverSyncStatus", serverId],
    queryFn: () => fetchServerSyncStatus(serverId),
    refetchInterval: (query) => {
      const queryData = query.state.data as ServerSyncStatus | undefined;
      if (!queryData) return 2000;
      return queryData.server.syncStatus === "completed" ||
        queryData.server.syncStatus === "failed"
        ? false
        : 2000;
    },
    retry: 3,
    retryDelay: 2000,
  });

  // Call onComplete when sync is finished
  React.useEffect(() => {
    if (data?.server.isReady && onComplete) {
      onComplete();
    }
  }, [data?.server.isReady, onComplete]);

  const handleRedirectToDashboard = () => {
    router.push(`/servers/${serverId}/dashboard`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Checking Server Status...
          </CardTitle>
          <CardDescription>
            Loading sync status for {serverName}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Failed to Load Server Status</AlertTitle>
        <AlertDescription>
          {error instanceof Error
            ? error.message
            : "Unable to connect to job server"}
        </AlertDescription>
      </Alert>
    );
  }

  const { server } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Server Setup Progress
        </CardTitle>
        <CardDescription>
          {serverName} - {getSyncStepDescription(server.syncProgress)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Sync Progress</span>
            <span className="text-sm text-muted-foreground">
              {server.progressPercentage}%
            </span>
          </div>
          <Progress value={server.progressPercentage} className="w-full" />
        </div>

        {/* Status Information */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(server.syncStatus, server.syncProgress)}
              <span className="font-medium">Status</span>
            </div>
            <Badge
              variant={
                server.syncStatus === "completed"
                  ? "default"
                  : server.syncStatus === "syncing"
                  ? "secondary"
                  : server.syncStatus === "failed"
                  ? "destructive"
                  : "outline"
              }
            >
              {server.syncStatus}
            </Badge>
          </div>

          <div className="space-y-2">
            <span className="font-medium">Current Step</span>
            <p className="text-sm text-muted-foreground capitalize">
              {server.syncProgress.replace("_", " ")}
            </p>
          </div>
        </div>

        {/* Timing Information */}
        {server.lastSyncStarted && (
          <div className="space-y-2">
            <span className="font-medium">Started</span>
            <p className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(server.lastSyncStarted), {
                addSuffix: true,
              })}
            </p>
          </div>
        )}

        {server.lastSyncCompleted && (
          <div className="space-y-2">
            <span className="font-medium">Completed</span>
            <p className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(server.lastSyncCompleted), {
                addSuffix: true,
              })}
            </p>
          </div>
        )}

        {/* Error Display */}
        {server.syncError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Sync Error</AlertTitle>
            <AlertDescription>{server.syncError}</AlertDescription>
          </Alert>
        )}

        {/* Success State */}
        {server.isReady && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Setup Complete!</AlertTitle>
            <AlertDescription>
              Your server has been successfully configured and synced. You can
              now access your dashboard.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        {server.isReady && showRedirectButton && (
          <div className="flex justify-end">
            <Button
              onClick={handleRedirectToDashboard}
              className="flex items-center gap-2"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {server.syncStatus === "failed" && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Setup
            </Button>
          </div>
        )}

        {/* Progress Steps Indicator */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Setup Steps</span>
          <div className="grid grid-cols-5 gap-2">
            {["users", "libraries", "items", "activities", "completed"].map(
              (step, index) => {
                const isCompleted = server.progressPercentage > index * 25;
                const isCurrent = server.syncProgress === step;

                return (
                  <div
                    key={step}
                    className={`text-center p-2 rounded text-xs ${
                      isCompleted
                        ? "bg-green-100 text-green-800"
                        : isCurrent
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {step === "completed"
                      ? "Done"
                      : step.charAt(0).toUpperCase() + step.slice(1)}
                  </div>
                );
              }
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
