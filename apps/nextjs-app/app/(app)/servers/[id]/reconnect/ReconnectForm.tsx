"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Settings } from "lucide-react";
import { toast } from "sonner";
import { updateServerConnectionAction } from "./actions";

interface ReconnectFormProps {
  serverId: number;
  serverName: string;
  currentUrl: string;
}

export function ReconnectForm({
  serverId,
  serverName,
  currentUrl,
}: ReconnectFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(currentUrl);
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(serverName);

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
        apiKey,
        username,
        password,
        name,
      });

      if (result.success) {
        toast.success(result.message);
        router.push(`/servers/${serverId}/dashboard`);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Error updating server connection:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Server Unreachable</AlertTitle>
        <AlertDescription>
          Unable to connect to <strong>{serverName}</strong>. The Jellyfin
          server may be offline, or the URL may have changed.
        </AlertDescription>
      </Alert>

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
              <Label htmlFor="name">Server Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Jellyfin Server"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">
                Server URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:8096"
                required
              />
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

