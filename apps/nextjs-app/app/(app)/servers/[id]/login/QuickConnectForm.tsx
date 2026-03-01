"use client";

import { useRouter } from "nextjs-toploader/app";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import {
  initiateQuickConnectLogin,
  loginWithQuickConnect,
} from "@/lib/auth";

type Phase = "idle" | "initiating" | "waiting" | "authenticating" | "error";

interface Props {
  serverId: number;
}

export const QuickConnectForm: React.FC<Props> = ({ serverId }) => {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [code, setCode] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearPolling();
  }, [clearPolling]);

  const startQuickConnect = useCallback(async () => {
    setPhase("initiating");
    setErrorMessage("");
    clearPolling();

    try {
      const result = await initiateQuickConnectLogin({ serverId });
      setCode(result.code);
      setPhase("waiting");

      intervalRef.current = setInterval(async () => {
        try {
          const res = await fetch("/api/quick-connect/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serverId: String(serverId), secret: result.secret }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as { authenticated: boolean };
          if (data.authenticated) {
            clearPolling();
            setPhase("authenticating");
            try {
              await loginWithQuickConnect({
                serverId,
                secret: result.secret,
              });
              toast.success("Logged in successfully");
              router.push(`/servers/${serverId}/dashboard`);
            } catch {
              setPhase("error");
              setErrorMessage("Failed to complete login");
            }
          }
        } catch {
          // Polling error — keep trying
        }
      }, 3000);
    } catch (error) {
      setPhase("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to start QuickConnect",
      );
    }
  }, [serverId, clearPolling, router]);

  if (phase === "idle") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Start QuickConnect and enter the code on a device where you&apos;re
          already signed in to Jellyfin.
        </p>
        <Button onClick={startQuickConnect} className="w-full">
          Start QuickConnect
        </Button>
      </div>
    );
  }

  if (phase === "initiating") {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
        <span className="ml-2 text-sm text-muted-foreground">
          Starting QuickConnect...
        </span>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Enter this code in Jellyfin:
          </p>
          <p className="text-4xl font-mono font-bold tracking-widest">
            {code}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          <span>Waiting for authorization...</span>
        </div>
        <Button
          variant="outline"
          onClick={startQuickConnect}
          className="w-full"
        >
          Get New Code
        </Button>
      </div>
    );
  }

  if (phase === "authenticating") {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
        <span className="ml-2 text-sm text-muted-foreground">
          Logging in...
        </span>
      </div>
    );
  }

  // error phase
  return (
    <div className="space-y-4">
      <p className="text-sm text-destructive">{errorMessage}</p>
      <Button onClick={startQuickConnect} className="w-full">
        Try Again
      </Button>
    </div>
  );
};
