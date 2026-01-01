"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [showWarning, setShowWarning] = useState(false);

  const internalUrlChanged = (internalUrl || "") !== (initialInternalUrl || "");

  const submitForm = async () => {
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
        setApiKey("");
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (internalUrlChanged) {
      setShowWarning(true);
    } else {
      await submitForm();
    }
  };

  const handleConfirm = async () => {
    setShowWarning(false);
    await submitForm();
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
            <Label htmlFor="apiKey">API Key (Optional)</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave empty to keep current key"
            />
            <p className="text-sm text-muted-foreground">
              Only enter a new key if you want to change it
            </p>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? <Spinner /> : "Update Connection Settings"}
          </Button>
        </form>
      </CardContent>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Warning: Internal URL Change</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the internal URL can be dangerous. If the URL is
              incorrect, Streamystats will not be able to communicate with your
              Jellyfin server, which may prevent you from logging in or
              accessing your data.
              <br />
              <br />
              Make sure the URL is correct and accessible from the server
              running Streamystats. If you get locked out, you will need to fix
              the URL directly in the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              I understand, proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
