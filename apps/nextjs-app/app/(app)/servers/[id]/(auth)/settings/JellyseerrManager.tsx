"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import type { Server } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ExternalLink, TestTube, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  saveJellyseerrConfig,
  testJellyseerrConnection,
  syncJellyseerrPopularMovies,
} from "@/lib/db/server";

export function JellyseerrManager({ server }: { server: Server }) {
  // Jellyseerr configuration state
  const [jellyseerrUrl, setJellyseerrUrl] = useState(
    server.jellyseerrUrl || ""
  );
  const [enableIntegration, setEnableIntegration] = useState(
    server.enableJellyseerrIntegration || false
  );
  const [enableSync, setEnableSync] = useState(
    server.jellyseerrSyncEnabled || false
  );

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSaveConfiguration = async () => {
    setIsSaving(true);
    try {
      await saveJellyseerrConfig({
        serverId: server.id,
        config: {
          jellyseerrUrl,
          enableIntegration,
          enableSync,
        },
      });
      toast.success("Jellyseerr configuration saved successfully");
    } catch (error) {
      toast.error("Failed to save Jellyseerr configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!jellyseerrUrl) {
      toast.error("Please provide a Jellyseerr URL to test connection");
      return;
    }

    setIsTestingConnection(true);
    try {
      await testJellyseerrConnection({ jellyseerrUrl });
      toast.success("Connection test successful!");
    } catch (error) {
      toast.error("Connection test failed. Please check your configuration.");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSyncPopularMovies = async () => {
    if (!enableIntegration) {
      toast.error("Please enable Jellyseerr integration first");
      return;
    }

    setIsSyncing(true);
    try {
      await syncJellyseerrPopularMovies({ serverId: server.id });
      toast.success("Jellyseerr popular movies sync started successfully");
    } catch (error) {
      toast.error("Failed to start Jellyseerr sync");
    } finally {
      setIsSyncing(false);
    }
  };

  const hasValidConfig = jellyseerrUrl;
  const lastSyncDate = server.jellyseerrLastSync
    ? new Date(server.jellyseerrLastSync).toLocaleString()
    : "Never";

  return (
    <div className="space-y-6">
      {/* Connection Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Jellyseerr Connection
                <Badge variant={hasValidConfig ? "default" : "secondary"}>
                  {hasValidConfig ? "Configured" : "Not Configured"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Configure your Jellyseerr instance URL. User authentication will
                happen automatically during login.
              </CardDescription>
            </div>
            {jellyseerrUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(jellyseerrUrl, "_blank")}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Jellyseerr
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jellyseerr-url">Jellyseerr URL</Label>
              <Input
                id="jellyseerr-url"
                placeholder="https://jellyseerr.example.com"
                value={jellyseerrUrl}
                onChange={(e) => setJellyseerrUrl(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-integration">
                Enable Jellyseerr Integration
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable integration with Jellyseerr for AI recommendations
              </p>
            </div>
            <Switch
              id="enable-integration"
              checked={enableIntegration}
              onCheckedChange={setEnableIntegration}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-sync">Auto-sync Popular Movies</Label>
              <p className="text-sm text-muted-foreground">
                Automatically sync popular movies from Jellyseerr for
                recommendations
              </p>
            </div>
            <Switch
              id="enable-sync"
              checked={enableSync}
              onCheckedChange={setEnableSync}
              disabled={!enableIntegration}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={!hasValidConfig || isTestingConnection}
            className="flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            {isTestingConnection ? "Testing..." : "Test Connection"}
          </Button>
          <Button
            onClick={handleSaveConfiguration}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            {isSaving ? "Saving..." : "Save Configuration"}
          </Button>
        </CardFooter>
      </Card>

      {/* Sync Status and Actions */}
      {enableIntegration && (
        <Card>
          <CardHeader>
            <CardTitle>Popular Movies Sync</CardTitle>
            <CardDescription>
              Sync popular movies from Jellyseerr to enhance AI recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Last Sync</p>
                <p className="text-sm text-muted-foreground">{lastSyncDate}</p>
              </div>
              <Badge variant={enableSync ? "default" : "secondary"}>
                {enableSync ? "Auto-sync Enabled" : "Manual Only"}
              </Badge>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSyncPopularMovies}
              disabled={!hasValidConfig || isSyncing}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {isSyncing ? "Syncing..." : "Sync Popular Movies"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>About Jellyseerr Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This integration allows StreamyStats to:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
            <li>Fetch popular movies from Jellyseerr</li>
            <li>Generate AI embeddings for popular movies</li>
            <li>Include popular movies in personalized recommendations</li>
            <li>Enable users to request new content through the interface</li>
          </ul>
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              User credentials are managed per-user. When you log in,
              StreamyStats will attempt to authenticate with Jellyseerr using
              your Jellyfin credentials.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Embeddings:</strong> If AI embeddings are enabled, popular
              movies will be automatically processed for AI recommendations
              after syncing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
