"use client";

import {
  type CronJobDefaultConfig,
  type IntervalJobDefaultConfig,
  isCronJob,
  isIntervalJob,
  JOB_DEFAULTS,
  type JobKey,
} from "@streamystats/database/job-defaults";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  getJobConfigs,
  type JobConfigItem,
} from "@/app/(app)/servers/[id]/(auth)/settings/jobs/actions";
import { JobConfigModal } from "@/app/(app)/servers/[id]/(auth)/settings/jobs/JobConfigModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type JobEvent, useJobEvents } from "@/hooks/useJobEvents";
import {
  JOB_NAME_TO_KEY,
  type ServerJobState,
  type ServerJobStatusItem,
  type ServerJobStatusResponse,
} from "@/lib/types/job-status";
import { fetch } from "@/lib/utils";

// Maps pg-boss job keys (from status API) to scheduler job keys (for configuration)
const STATUS_KEY_TO_SCHEDULER_KEY: Record<string, JobKey> = {
  "jellyfin-full-sync": "full-sync",
  "jellyfin-users-sync": "user-sync",
  "jellyfin-libraries-sync": "full-sync", // Part of full sync
  "jellyfin-items-sync": "full-sync", // Part of full sync
  "jellyfin-activities-sync": "activity-sync",
  "jellyfin-recent-items-sync": "recent-items-sync",
  "jellyfin-recent-activities-sync": "activity-sync",
  "jellyfin-people-sync": "people-sync",
  "jellyfin-ratings-sync": "ratings-sync",
  "generate-item-embeddings": "embeddings-sync",
};

function getStateBadgeVariant(
  state: ServerJobState,
): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "running":
      return "default";
    case "queued":
      return "secondary";
    case "scheduled":
      return "outline";
    case "failed":
      return "destructive";
    case "cancelled":
    case "stopped":
      return "outline";
  }
}

function getStateBadgeClass(state: ServerJobState): string {
  switch (state) {
    case "running":
      return "bg-blue-600 hover:bg-blue-600";
    case "queued":
      return "bg-amber-500 hover:bg-amber-500 text-white";
    case "scheduled":
      return "bg-slate-500 hover:bg-slate-500 text-white";
    case "failed":
      return "";
    case "cancelled":
      return "bg-slate-400 hover:bg-slate-400";
    case "stopped":
      return "bg-zinc-700 hover:bg-zinc-700 text-zinc-300";
  }
}

async function fetchServerJobStatus(
  serverId: number,
): Promise<ServerJobStatusResponse> {
  const response = await fetch(`/api/jobs/servers/${serverId}/status`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

function updateJobFromEvent(
  jobs: ServerJobStatusItem[],
  event: JobEvent,
): ServerJobStatusItem[] {
  if (!event.jobName) return jobs;

  const jobKey = JOB_NAME_TO_KEY[event.jobName];
  if (!jobKey) return jobs;

  return jobs.map((job) => {
    if (job.key !== jobKey) return job;

    const now = new Date().toISOString();

    switch (event.type) {
      case "started":
        return {
          ...job,
          state: "running" as const,
          activeSince: now,
          updatedAt: now,
          lastError: undefined,
        };
      case "completed":
        return {
          ...job,
          state: "stopped" as const,
          activeSince: undefined,
          updatedAt: now,
          lastError: undefined,
        };
      case "failed":
        return {
          ...job,
          state: "failed" as const,
          activeSince: undefined,
          updatedAt: now,
          lastError: event.error,
        };
      default:
        return job;
    }
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString();
}

function JobsCardHeader() {
  return (
    <CardHeader>
      <CardTitle>All Jobs</CardTitle>
      <CardDescription>
        Below are all jobs that can run on the server and their status. Jobs can
        run in parallell and does not affect one another.
      </CardDescription>
    </CardHeader>
  );
}

interface ServerJobStatusCardProps {
  serverId: number;
  isAdmin?: boolean;
}

export function ServerJobStatusCard({
  serverId,
  isAdmin = false,
}: ServerJobStatusCardProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["serverJobStatus", serverId],
    queryFn: () => fetchServerJobStatus(serverId),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 2,
  });

  // Fetch job configs for admin users
  const { data: configsData } = useQuery({
    queryKey: ["jobConfigs", serverId],
    queryFn: async () => {
      const result = await getJobConfigs(serverId);
      return result.success ? result.configs : [];
    },
    enabled: isAdmin,
    staleTime: 60000, // Cache for 1 minute
  });

  const [jobs, setJobs] = useState<ServerJobStatusItem[]>([]);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<{
    key: string;
    label: string;
    description: string;
    type: "cron" | "interval";
    // For cron jobs
    defaultCron?: string;
    cronExpression?: string | null;
    // For interval jobs
    defaultInterval?: number;
    intervalSeconds?: number | null;
    enabled: boolean;
  } | null>(null);

  // Build a map of job configs for quick lookup
  const jobConfigMap = new Map<string, JobConfigItem>();
  if (configsData) {
    for (const config of configsData) {
      jobConfigMap.set(config.jobKey, config);
    }
  }

  useEffect(() => {
    if (data?.jobs) {
      setJobs(data.jobs);
    }
  }, [data?.jobs]);

  const handleJobEvent = useCallback(
    (event: JobEvent) => {
      if (event.serverId !== serverId) return;
      if (!event.jobName) return;

      setJobs((prev) => updateJobFromEvent(prev, event));
    },
    [serverId],
  );

  useJobEvents({ onJobEvent: handleJobEvent });

  const handleConfigureClick = (jobKey: string) => {
    // For session-polling, the key is used directly; for others, map status key to scheduler key
    const schedulerKey =
      jobKey === "session-polling"
        ? ("session-polling" as JobKey)
        : STATUS_KEY_TO_SCHEDULER_KEY[jobKey];

    if (!schedulerKey) {
      console.warn(`No scheduler mapping for job key: ${jobKey}`);
      return;
    }

    const config = jobConfigMap.get(schedulerKey);
    const defaultConfig = JOB_DEFAULTS[schedulerKey];

    if (isCronJob(schedulerKey)) {
      const cronConfig = defaultConfig as CronJobDefaultConfig;
      if (config) {
        setSelectedJob({
          key: config.jobKey,
          label: config.label,
          description: config.description,
          type: "cron",
          defaultCron: config.defaultCron,
          cronExpression: config.cronExpression,
          enabled: config.enabled,
        });
      } else {
        setSelectedJob({
          key: schedulerKey,
          label: cronConfig.label,
          description: cronConfig.description,
          type: "cron",
          defaultCron: cronConfig.defaultCron,
          cronExpression: null,
          enabled: true,
        });
      }
      setConfigModalOpen(true);
    } else if (isIntervalJob(schedulerKey)) {
      const intervalConfig = defaultConfig as IntervalJobDefaultConfig;
      if (config) {
        setSelectedJob({
          key: config.jobKey,
          label: config.label,
          description: config.description,
          type: "interval",
          defaultInterval: config.defaultInterval,
          intervalSeconds: config.intervalSeconds,
          enabled: config.enabled,
        });
      } else {
        setSelectedJob({
          key: schedulerKey,
          label: intervalConfig.label,
          description: intervalConfig.description,
          type: "interval",
          defaultInterval: intervalConfig.defaultInterval,
          intervalSeconds: null,
          enabled: true,
        });
      }
      setConfigModalOpen(true);
    }
  };

  const handleConfigSave = () => {
    // Invalidate the job configs query to refetch
    queryClient.invalidateQueries({ queryKey: ["jobConfigs", serverId] });
  };

  if (isLoading) {
    return (
      <Card>
        <JobsCardHeader />
        <CardContent className="text-sm text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.success) {
    return (
      <Card>
        <JobsCardHeader />
        <CardContent className="text-sm text-muted-foreground">
          Not available.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <JobsCardHeader />
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead className="hidden md:table-cell">Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Details</TableHead>
                {isAdmin && (
                  <TableHead className="w-[50px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const schedulerKey = STATUS_KEY_TO_SCHEDULER_KEY[job.key];
                const config = schedulerKey
                  ? jobConfigMap.get(schedulerKey)
                  : undefined;
                const isDisabled = config && !config.enabled;
                const hasSchedulerMapping = !!schedulerKey;

                return (
                  <TableRow
                    key={job.key}
                    className={isDisabled ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {job.label}
                        {isDisabled && (
                          <Badge variant="outline" className="text-xs">
                            Disabled
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {schedulerKey ? (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {(() => {
                            const jobConfig = JOB_DEFAULTS[schedulerKey];
                            if (jobConfig.type === "cron") {
                              return (
                                config?.cronExpression || jobConfig.defaultCron
                              );
                            } else {
                              const seconds =
                                config?.intervalSeconds ??
                                jobConfig.defaultInterval;
                              return `${seconds}s`;
                            }
                          })()}
                        </code>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStateBadgeVariant(job.state)}
                        className={getStateBadgeClass(job.state)}
                      >
                        {job.state}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {job.state === "running" && job.activeSince && (
                        <span>Running since {formatTime(job.activeSince)}</span>
                      )}
                      {job.state === "scheduled" && job.scheduledFor && (
                        <span>
                          Scheduled for {formatTime(job.scheduledFor)}
                        </span>
                      )}
                      {job.state === "failed" && job.lastError && (
                        <span className="text-destructive">
                          {job.lastError}
                        </span>
                      )}
                      {job.state === "stopped" && <span>Idle</span>}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {hasSchedulerMapping ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleConfigureClick(job.key)}
                              >
                                <Settings className="mr-2 h-4 w-4" />
                                Configure Schedule
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {/* Session Polling Row */}
              {(() => {
                const sessionPollingConfig =
                  jobConfigMap.get("session-polling");
                const sessionPollingDefaults = JOB_DEFAULTS["session-polling"];
                const isDisabled =
                  sessionPollingConfig && !sessionPollingConfig.enabled;

                return (
                  <TableRow className={isDisabled ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {sessionPollingDefaults.label}
                        {isDisabled && (
                          <Badge variant="outline" className="text-xs">
                            Disabled
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        5s
                      </code>
                      <span className="text-xs text-muted-foreground ml-1">
                        (fixed)
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="default"
                        className="bg-blue-600 hover:bg-blue-600"
                      >
                        running
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      <span>Polls Jellyfin for active sessions</span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleConfigureClick("session-polling")
                              }
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              Configure
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedJob && selectedJob.type === "cron" && (
        <JobConfigModal
          open={configModalOpen}
          onOpenChange={setConfigModalOpen}
          serverId={serverId}
          jobKey={selectedJob.key}
          jobLabel={selectedJob.label}
          description={selectedJob.description}
          type="cron"
          defaultCron={selectedJob.defaultCron!}
          currentCron={selectedJob.cronExpression ?? null}
          enabled={selectedJob.enabled}
          onSave={handleConfigSave}
        />
      )}
      {selectedJob && selectedJob.type === "interval" && (
        <JobConfigModal
          open={configModalOpen}
          onOpenChange={setConfigModalOpen}
          serverId={serverId}
          jobKey={selectedJob.key}
          jobLabel={selectedJob.label}
          description={selectedJob.description}
          type="interval"
          defaultInterval={selectedJob.defaultInterval!}
          currentInterval={selectedJob.intervalSeconds ?? null}
          enabled={selectedJob.enabled}
          onSave={handleConfigSave}
        />
      )}
    </>
  );
}
