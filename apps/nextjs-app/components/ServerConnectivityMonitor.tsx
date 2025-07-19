"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

type ServerError = {
  serverId: number;
  name: string;
  status?: number;
  error: string;
};

export function ServerConnectivityMonitor() {
  const [hasConnectivityIssue, setHasConnectivityIssue] = useState(false);
  const [serverErrors, setServerErrors] = useState<ServerError[]>([]);
  const pathname = usePathname();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  // Track last notification time to avoid spamming
  const [lastNotificationTime, setLastNotificationTime] = useState(0);
  const MIN_NOTIFICATION_INTERVAL = 60000; // 1 minute between notifications

  // Reset when page changes
  useEffect(() => {
    // When navigating to a new page, we'll check again but won't reset hasConnectivityIssue
    // This prevents showing the same toast repeatedly when navigating
  }, [pathname]);

  const shouldShowNotification = () => {
    const now = Date.now();
    // Check if enough time has elapsed since the last notification
    if (now - lastNotificationTime > MIN_NOTIFICATION_INTERVAL) {
      setLastNotificationTime(now);
      return true;
    }
    return false;
  };

  // Show a toast for connectivity issues
  const showConnectivityErrorToast = (servers: ServerError[]) => {
    if (!shouldShowNotification()) return;

    // Get affected server names
    const serverNames = servers.map((s) => s.name).join(", ");

    toast.error("Jellyfin Server Connectivity Issue", {
      id: "server-connectivity-error",
      description:
        servers.length > 1
          ? `Cannot connect to Jellyfin servers: ${serverNames}. Some features may be unavailable.`
          : `Cannot connect to Jellyfin server: ${serverNames}. Some features may be unavailable.`,
      duration: 10000,
      action: {
        label: "Retry",
        onClick: () => checkServerConnectivity(),
      },
    });
  };

  // Show a toast when connectivity is restored
  const showConnectivityRestoredToast = () => {
    if (hasConnectivityIssue) {
      toast.success("Jellyfin Server Connection Restored", {
        id: "server-connectivity-restored",
        description: "Connection to the Jellyfin server has been restored.",
        duration: 5000,
      });

      // Dismiss any existing error toasts
      toast.dismiss("server-connectivity-error");
      toast.dismiss("jellyfin-sessions-error");
    }
  };

  const checkServerConnectivity = async () => {
    try {
      // Make a request to check for server connectivity
      const response = await fetch(`${basePath}/api/check-connectivity`, {
        method: "GET",
        cache: "no-store",
      });

      const hasError =
        response.headers.get("x-server-connectivity-error") === "true";

      // If we have response data with server details
      try {
        const data = await response.json();
        if (data && data.servers) {
          setServerErrors(data.servers);
        }
      } catch (e) {
        // JSON parsing error, ignore
      }

      // Update state based on current connectivity status
      if (hasError) {
        // If this is a new connectivity issue, show a toast
        if (!hasConnectivityIssue) {
          setHasConnectivityIssue(true);
          showConnectivityErrorToast(serverErrors);
        }
      } else {
        // If connectivity was previously down and is now restored, show a toast
        if (hasConnectivityIssue) {
          setHasConnectivityIssue(false);
          setServerErrors([]);
          showConnectivityRestoredToast();
        }
      }
    } catch (error) {
      console.error("Error checking server connectivity:", error);
    }
  };

  useEffect(() => {
    // Check immediately on mount
    checkServerConnectivity();

    // Set up interval to check every 15 seconds
    const intervalId = setInterval(checkServerConnectivity, 15000);

    return () => clearInterval(intervalId);
  }, [hasConnectivityIssue]);

  // This component doesn't render anything visible
  return null;
}
