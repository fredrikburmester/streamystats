"use client";

import { ServerManagement } from "@/components/ServerManagement";
import { Server } from "@/lib/db";

interface ServerManagementWrapperProps {
  servers: Server[];
}

export const ServerManagementWrapper: React.FC<
  ServerManagementWrapperProps
> = ({ servers }) => {
  return <ServerManagement servers={servers} />;
};
