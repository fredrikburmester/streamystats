"use client";

import { AlertCircle, RefreshCw, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateServerConnectionAction } from "./actions";

interface ReconnectFormProps {
  serverId: number;
  serverName: string;
  currentUrl: string;
  currentInternalUrl?: string | null;
  showUnreachableAlert?: boolean;
}

export function ReconnectForm({
  serverId,
  serverName,
  currentUrl,
  currentInternalUrl,
  showUnreachableAlert = true,
}: ReconnectFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(currentUrl);
  const [internalUrl, setInternalUrl] = useState(currentInternalUrl || "");
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleTryReconnect = () => {
    router.push(`/servers/${serverId}/dashboard`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await updateServerConnectionAction({
        serverId,
        url,
        internalUrl: internalUrl || undefined,
        apiKey,
        username,
        password,
      });

      if (result.success) {
        toast.success(result.message);
        router.push(`/servers/${serverId}/dashboard`);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {showUnreachableAlert && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Server Unreachable</AlertTitle>
          <AlertDescription>
            Unable to connect to <strong>{serverName}</strong>. The Jellyfin
            server may be offline, or the URL may have changed.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reconnect to Server</CardTitle>
          <CardDescription>
            Try reconnecting or update the server connection details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleTryReconnect}
            variant="outline"
            className="w-full"
            type="button"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try to Reconnect
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or update connection details
              </span>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Administrator Credentials Required</AlertTitle>
            <AlertDescription>
              To update server connection settings, you must authenticate with
              an administrator account on the new Jellyfin server.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">
                External URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:8096"
                required
              />
              <p className="text-sm text-muted-foreground">
                Public URL used by clients to access Jellyfin
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="internalUrl">Internal URL (Optional)</Label>
              <Input
                id="internalUrl"
                type="text"
                value={internalUrl}
                onChange={(e) => setInternalUrl(e.target.value)}
                placeholder="http://192.168.1.100:8096"
              />
              <p className="text-sm text-muted-foreground">
                Internal URL for server-to-server communication
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">
                API Key <span className="text-red-500">*</span>
              </Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Jellyfin API key"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">
                Admin Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your admin username"
                required
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Admin Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your admin password"
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              <Settings className="mr-2 h-4 w-4" />
              {loading ? "Updating..." : "Update Connection"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
