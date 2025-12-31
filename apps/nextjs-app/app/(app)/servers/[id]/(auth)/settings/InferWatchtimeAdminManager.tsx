"use client";

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cleanupInferredSessions,
  triggerInferWatchtime,
  triggerInferWatchtimeForAll,
} from "@/lib/db/infer-watchtime";

interface User {
  id: string;
  name: string;
}

interface InferWatchtimeAdminManagerProps {
  serverId: number;
  users: User[];
  totalInferredSessions: number;
}

export function InferWatchtimeAdminManager({
  serverId,
  users,
  totalInferredSessions: initialTotal,
}: InferWatchtimeAdminManagerProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isInferring, setIsInferring] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [totalInferred, setTotalInferred] = useState(initialTotal);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    timestamp: Date;
  } | null>(null);

  const handleInferWatchtime = async (forAllUsers: boolean) => {
    setIsInferring(true);
    setResult(null);

    try {
      const response = forAllUsers
        ? await triggerInferWatchtimeForAll(serverId)
        : await triggerInferWatchtime(serverId, selectedUserId);

      setResult({
        success: response.success,
        message: response.message || "Watchtime inference job started",
        timestamp: new Date(),
      });
    } catch (error) {
      setResult({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to start inference",
        timestamp: new Date(),
      });
    } finally {
      setIsInferring(false);
    }
  };

  const handleCleanupAll = async () => {
    setIsCleaning(true);
    setResult(null);

    try {
      const response = await cleanupInferredSessions(serverId);

      if (response.success) {
        setTotalInferred(0);
      }

      setResult({
        success: response.success,
        message: response.message || "Cleanup completed",
        timestamp: new Date(),
      });
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to cleanup",
        timestamp: new Date(),
      });
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Infer Watch History (Admin)
        </CardTitle>
        <CardDescription>
          Import watch history from Jellyfin's played status for users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Creates watch sessions for items marked as "Played" in Jellyfin.
            Useful for backfilling history for users who started using
            Streamystats after they already had watch history.
          </p>
        </div>

        {totalInferred > 0 && (
          <div className="bg-muted/50 border rounded-lg p-3">
            <p className="text-sm">
              <span className="font-medium">{totalInferred}</span> total
              inferred {totalInferred === 1 ? "session" : "sessions"} on this
              server
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Single user inference */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">
                Infer for specific user
              </p>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => handleInferWatchtime(false)}
              disabled={!selectedUserId || isInferring || isCleaning}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isInferring ? "animate-spin" : ""}`}
              />
              Infer
            </Button>
          </div>

          {/* All users inference */}
          <div className="border-t pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isInferring || isCleaning}
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Infer for All Users
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Infer for All Users?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create inferred watch sessions for all{" "}
                    {users.length} users based on their Jellyfin play history.
                    This may take a while for large libraries.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleInferWatchtime(true)}>
                    Start Inference
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Cleanup */}
        {totalInferred > 0 && (
          <div className="border-t pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isInferring || isCleaning}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {isCleaning ? "Cleaning..." : "Remove All Inferred Sessions"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Remove All Inferred Sessions?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {totalInferred} inferred{" "}
                    {totalInferred === 1 ? "session" : "sessions"} on this
                    server. Real watch sessions will not be affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCleanupAll}>
                    Remove All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertDescription className="space-y-1">
              <div>{result.message}</div>
              <div className="text-xs opacity-75">
                {result.timestamp.toLocaleString()}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-muted/50 border rounded-lg p-3">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Inferred sessions are marked separately and
            can be removed at any time. Real sessions from actual playback are
            never affected.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
