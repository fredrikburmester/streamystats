"use client";

import { Separator } from "@radix-ui/react-separator";
import { DeleteServer } from "./DeleteServer";
import { FullSyncTask } from "./FullSyncTask";
import { LibrariesSyncTask } from "./LibrariesSyncTask";
import { PartialSyncTask } from "./PartialSyncTask";
import { UsersSyncTask } from "./UsersSyncTask";
import { getSyncTasks, Server, SyncTask } from "@/lib/db";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

interface TasksProps {
  server: Server;
}

const queryClient = new QueryClient();

export const Tasks: React.FC<TasksProps> = ({ server }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <_Tasks server={server} />
    </QueryClientProvider>
  );
};

const _Tasks: React.FC<TasksProps> = ({ server }) => {
  const { data } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      return await getSyncTasks(server.id);
    },
    refetchInterval: 1000,
    staleTime: 0,
  });

  useEffect(() => {
    console.log(data);
  }, [data]);

  const running = useCallback(
    (type: SyncTask["sync_type"]) => {
      return data?.some((task) => {
        if (!task.sync_started_at) return false;

        const taskStartTime = new Date(task.sync_started_at);
        const currentTime = new Date();

        return (
          taskStartTime.getTime() <= currentTime.getTime() &&
          task.sync_type === type &&
          !task.sync_completed_at
        );
      });
    },
    [data]
  );

  const lastRunAt = useCallback(
    (type: SyncTask["sync_type"]) => {
      const d = data?.find(
        (task) => task.sync_type === type
      )?.sync_completed_at;
      if (!d) return undefined;

      const utcDate = new Date(d);
      return new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
    },
    [data]
  );

  return (
    <div>
      <FullSyncTask
        server={server}
        running={running("full_sync")}
        lastRun={lastRunAt("full_sync")}
      />
      <PartialSyncTask
        server={server}
        running={running("partial_sync")}
        lastRun={lastRunAt("partial_sync")}
      />
      <Separator className="my-8" />
      <UsersSyncTask server={server} />
      <LibrariesSyncTask server={server} />
      <Separator className="my-8" />
      <DeleteServer server={server} />
    </div>
  );
};