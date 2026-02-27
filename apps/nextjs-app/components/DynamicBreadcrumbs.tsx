"use client";

import { House } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getUserById } from "@/lib/db/users";
import { basePath } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";

const _map: Record<string, string> = {
  "backup-and-import": "Backup & Import",
  "database-backup-restore": "Database Backup & Restore",
  "jellystats-import": "Jellystats Import",
  "playback-reporting-import": "Playback Reporting Import",
  settings: "Settings",
  activities: "Activities",
  history: "History",
  items: "Items",
  users: "Users",
  library: "Library",
  dashboard: "Dashboard",
  watchtime: "Watchtime",
  transcoding: "Transcoding",
  clients: "Clients",
  chat: "AI Chat",
  ai: "AI Recommendations",
  general: "General",
  security: "Security",
  anomalies: "Anomalies",
  map: "Map",
  watchlists: "Watchlists",
  actors: "Actors",
  wrapped: "Wrapped",
};

export const DynamicBreadcrumbs: React.FC = () => {
  const params = useParams();
  const { id } = params as { id: string };
  const pathname = usePathname();
  const [dynamicLabels, setDynamicLabels] = useState<Record<string, string>>(
    {},
  );
  const fetchedRef = useRef<Set<string>>(new Set());

  const pathSegments = useMemo(
    () =>
      pathname
        .split("/")
        .filter((segment) => segment)
        .slice(2),
    [pathname],
  );

  useEffect(() => {
    let cancelled = false;

    const fetchDynamicLabels = async () => {
      const segments = pathname
        .split("/")
        .filter((segment) => segment)
        .slice(2);

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const prevSegment = segments[i - 1];

        // Fetch user name if previous segment is "users" and not already fetched
        if (
          prevSegment === "users" &&
          !_map[segment] &&
          !fetchedRef.current.has(segment)
        ) {
          fetchedRef.current.add(segment);

          try {
            const user = await getUserById({ userId: segment, serverId: id });
            if (!cancelled && user?.name) {
              setDynamicLabels((prev) => ({ ...prev, [segment]: user.name }));
            }
          } catch {
            // Ignore errors
          }
        }

        // Fetch watchlist name if previous segment is "watchlists" and not already fetched
        if (
          prevSegment === "watchlists" &&
          !_map[segment] &&
          !fetchedRef.current.has(`watchlist-${segment}`)
        ) {
          fetchedRef.current.add(`watchlist-${segment}`);

          try {
            const watchlistId = parseInt(segment, 10);
            if (!Number.isNaN(watchlistId)) {
              const response = await fetch(
                `${basePath}/api/watchlists/${watchlistId}`,
              );
              if (response.ok) {
                const data = await response.json();
                if (!cancelled && data?.data?.name) {
                  setDynamicLabels((prev) => ({
                    ...prev,
                    [segment]: data.data.name,
                  }));
                }
              }
            }
          } catch {
            // Ignore errors
          }
        }
      }
    };

    fetchDynamicLabels();

    return () => {
      cancelled = true;
    };
  }, [id, pathname]);

  const getLabel = (segment: string): string => {
    return dynamicLabels[segment] || _map[segment] || segment;
  };

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <BreadcrumbLink href={`${basePath}/servers/${id}/dashboard`}>
            <House className="h-4 w-4 ml-1" />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {pathSegments.map((segment, index) => {
          const url = `${basePath}/servers/${id}/${pathSegments
            .slice(0, index + 1)
            .join("/")}`;
          return (
            <React.Fragment key={url}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbLink
                  href={url}
                  className="truncate max-w-[120px] block"
                >
                  {getLabel(segment)}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
