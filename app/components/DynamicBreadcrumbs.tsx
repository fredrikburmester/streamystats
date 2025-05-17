"use client";

import { House } from "lucide-react";
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
                  {dynamicSegments.includes(segment)
                    ? segment.charAt(0).toUpperCase() + segment.slice(1)
                    : segment}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
