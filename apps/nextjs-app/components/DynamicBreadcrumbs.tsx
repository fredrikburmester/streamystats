"use client";

import { House, Slash } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";

const dynamicSegments = [
  "users",
  "items",
  "library",
  "history",
  "dashboard",
  "settings",
  "activities",
];

const subSegments = [
  "backup-and-import",
  "database-backup-restore",
  "jellystats-import",
  "playback-reporting-import",
];

const _map = {
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
  jellyseerr: "Jellyseerr",
};

export const DynamicBreadcrumbs: React.FC = () => {
  const params = useParams();

  const { id } = params as { id: string };

  const pathname = usePathname();
  const pathSegments = pathname
    .split("/")
    .filter((segment) => segment)
    .slice(2);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/servers/${id}/dashboard`}>
            <House className="h-4 w-4 ml-1" />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {pathSegments.map((segment, index) => {
          const url = `/servers/${id}/${pathSegments
            .slice(0, index + 1)
            .join("/")}`;
          return (
            <React.Fragment key={url}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={url}>
                  {_map[segment as keyof typeof _map] || segment}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
