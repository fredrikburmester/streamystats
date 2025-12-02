"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Database, CheckCircle, AlertTriangle, History } from "lucide-react";
import { toast } from "sonner";
import { fetch } from "@/lib/utils";

interface SyncManagerProps {
  serverId: number;
  serverName: string;
}

export function SyncManager({ serverId, serverName }: SyncManagerProps) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [isHistoricalSyncing, setIsHistoricalSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    message: string;
    timestamp: Date;
  } | null>(null);
  const [lastHistoricalResult, setLastHistoricalResult] = useState<{
    success: boolean;
    message: string;
    timestamp: Date;
  } | null>(null);

  const handleTriggerFullSync = async () => {
    setIsTriggering(true);
    setLastSyncResult(null);

    try {
      const response = await fetch("/api/jobs/trigger-full-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serverId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setLastSyncResult({
        success: true,
        message: data.message || "Full sync triggered successfully",
        timestamp: new Date(),
      });

      toast.success(`Full sync started for ${serverName}`, {
        description: "This may take several minutes to complete",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to trigger full sync";

      setLastSyncResult({
        success: false,
        message: errorMessage,
        timestamp: new Date(),
      });

      toast.error("Failed to trigger full sync", {
        description: errorMessage,
      });
    } finally {
      setIsTriggering(false);
    }
  };

  const handleTriggerHistoricalSync = async () => {
    setIsHistoricalSyncing(true);
    setLastHistoricalResult(null);

    try {
      const response = await fetch("/api/jobs/process-historical-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serverId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setLastHistoricalResult({
        success: true,
        message: data.message || "Historical session processing started successfully",
        timestamp: new Date(),
      });

      toast.success(`Historical session processing started for ${serverName}`, {
        description: "Converting activity logs to session records",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start historical session processing";

      setLastHistoricalResult({
        success: false,
        message: errorMessage,
        timestamp: new Date(),
      });

      toast.error("Failed to start historical session processing", {
        description: errorMessage,
      });
    } finally {
      setIsHistoricalSyncing(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Data Synchronization
        </CardTitle>
        <CardDescription>
          Manually trigger a complete sync of all data from your Jellyfin server
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            A full sync will update:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• Users and permissions</li>
            <li>• Media libraries and collections</li>
            <li>• All media items and metadata</li>
            <li>• Activity and playback history</li>
          </ul>
        </div>

        <div className="pt-2">
          <Button
            onClick={handleTriggerFullSync}
            disabled={isTriggering}
            className="flex items-center gap-2"
            size="lg"
          >
            <RefreshCw
              className={`h-4 w-4 ${isTriggering ? "animate-spin" : ""}`}
            />
            {isTriggering ? "Triggering Sync..." : "Start Full Sync"}
          </Button>
        </div>

        {lastSyncResult && (
          <Alert
            variant={lastSyncResult.success ? "default" : "destructive"}
            className="mt-4"
          >
            {lastSyncResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertDescription className="space-y-1">
              <div>{lastSyncResult.message}</div>
              <div className="text-xs opacity-75">
                {lastSyncResult.timestamp.toLocaleString()}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Full syncs can take several minutes to hours
            depending on your library size. The sync will run in the background
            and you can monitor progress from the dashboard.
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historical Session Processing
        </CardTitle>
        <CardDescription>
          Convert historical activity log entries into session records for analytics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            This will process your activity logs to create historical session data:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• Analyzes playback activities from your activity log</li>
            <li>• Reconstructs viewing sessions with estimated durations</li>
            <li>• Creates session records for historical analytics</li>
            <li>• Enables viewing statistics from before session tracking</li>
          </ul>
        </div>

        <div className="pt-2">
          <Button
            onClick={handleTriggerHistoricalSync}
            disabled={isHistoricalSyncing}
            className="flex items-center gap-2"
            size="lg"
            variant="outline"
          >
            <History
              className={`h-4 w-4 ${isHistoricalSyncing ? "animate-spin" : ""}`}
            />
            {isHistoricalSyncing ? "Processing..." : "Process Historical Sessions"}
          </Button>
        </div>

        {lastHistoricalResult && (
          <Alert
            variant={lastHistoricalResult.success ? "default" : "destructive"}
            className="mt-4"
          >
            {lastHistoricalResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertDescription className="space-y-1">
              <div>{lastHistoricalResult.message}</div>
              <div className="text-xs opacity-75">
                {lastHistoricalResult.timestamp.toLocaleString()}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Info:</strong> This is a one-time process that converts your 
            existing activity logs into session records. It will automatically 
            skip duplicate sessions and only process new historical data.
          </p>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
