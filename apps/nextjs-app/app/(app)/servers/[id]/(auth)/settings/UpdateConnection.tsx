"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
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
import { updateConnectionSettingsAction } from "./actions";

interface UpdateConnectionProps {
  serverId: number;
  url: string;
  internalUrl?: string | null;
}

export function UpdateConnection({
  serverId,
  url: initialUrl,
  internalUrl: initialInternalUrl,
}: UpdateConnectionProps) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(initialUrl);
  const [internalUrl, setInternalUrl] = useState(initialInternalUrl || "");
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await updateConnectionSettingsAction({
        serverId,
        url,
        internalUrl: internalUrl || undefined,
        apiKey,
      });

      if (result.success) {
        toast.success(result.message);
        setApiKey(""); // Clear API key after successful update
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
    <Card>
      <CardHeader>
        <CardTitle>Connection Settings</CardTitle>
        <CardDescription>
          Update the server URL, internal URL, or API key
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">External URL</Label>
            <Input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://jellyfin.example.com"
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
              Internal URL for server-to-server communication (e.g., local
              network IP)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Jellyfin API key"
              required
            />
            <p className="text-sm text-muted-foreground">
              Get the API key from the Jellyfin admin dashboard
            </p>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? <Spinner /> : "Update Connection Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
