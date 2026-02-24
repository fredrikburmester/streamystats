"use server";

import { JOB_DEFAULTS, type JobKey } from "@streamystats/database";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { isUserAdmin } from "@/lib/db/users";

const JOB_SERVER_URL = process.env.JOB_SERVER_URL || "http://localhost:3005";

const serverIdSchema = z.number().int().positive();
const jobKeySchema = z.string().min(1).max(200);
const updateJobConfigSchema = z.object({
  cronExpression: z.string().max(200).nullish(),
  intervalSeconds: z.number().int().positive().max(86400).nullish(),
  enabled: z.boolean().optional(),
});

export interface JobConfigItem {
  jobKey: string;
  label: string;
  description: string;
  category: string;
  type: "cron" | "interval";
  // For cron-based jobs
  defaultCron?: string;
  cronExpression?: string | null;
  // For interval-based jobs
  defaultInterval?: number;
  intervalSeconds?: number | null;
  enabled: boolean;
  isUsingDefault: boolean;
}

export interface GetJobConfigsResponse {
  success: boolean;
  serverId?: number;
  configs?: JobConfigItem[];
  error?: string;
}

/**
 * Server action to get all job configurations for a server
 */
export async function getJobConfigs(
  serverId: number,
): Promise<GetJobConfigsResponse> {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return { success: false, error: "Admin privileges required" };
    }

    const parsedId = serverIdSchema.safeParse(serverId);
    if (!parsedId.success) {
      return { success: false, error: "Invalid server ID" };
    }

    const response = await fetch(
      `${JOB_SERVER_URL}/api/jobs/servers/${parsedId.data}/config`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || "Failed to get job configs",
      };
    }

    const data = await response.json();
    return {
      success: true,
      serverId: data.serverId,
      configs: data.configs,
    };
  } catch (error) {
    console.error("Error getting job configs:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get job configs",
    };
  }
}

export interface UpdateJobConfigParams {
  cronExpression?: string | null;
  intervalSeconds?: number | null;
  enabled?: boolean;
}

export interface UpdateJobConfigResponse {
  success: boolean;
  config?: {
    jobKey: string;
    label: string;
    cronExpression: string | null;
    enabled: boolean;
    isUsingDefault: boolean;
  };
  error?: string;
}

/**
 * Server action to update a job configuration for a server
 */
export async function updateJobConfig(
  serverId: number,
  jobKey: JobKey,
  config: UpdateJobConfigParams,
): Promise<UpdateJobConfigResponse> {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return { success: false, error: "Admin privileges required" };
    }

    const parsedId = serverIdSchema.safeParse(serverId);
    const parsedKey = jobKeySchema.safeParse(jobKey);
    const parsedConfig = updateJobConfigSchema.safeParse(config);
    if (!parsedId.success || !parsedKey.success || !parsedConfig.success) {
      return { success: false, error: "Invalid input" };
    }

    const response = await fetch(
      `${JOB_SERVER_URL}/api/jobs/servers/${parsedId.data}/config/${parsedKey.data}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedConfig.data),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || "Failed to update job config",
      };
    }

    const data = await response.json();

    // Revalidate the jobs page
    revalidatePath(`/servers/${serverId}/settings/jobs`);

    return {
      success: true,
      config: data.config,
    };
  } catch (error) {
    console.error("Error updating job config:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update job config",
    };
  }
}

export interface ResetJobConfigResponse {
  success: boolean;
  config?: {
    jobKey: string;
    label: string;
    cronExpression: null;
    enabled: true;
    isUsingDefault: true;
    defaultCron: string;
  };
  error?: string;
}

/**
 * Server action to reset a job configuration to default
 */
export async function resetJobConfig(
  serverId: number,
  jobKey: JobKey,
): Promise<ResetJobConfigResponse> {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return { success: false, error: "Admin privileges required" };
    }

    const parsedId = serverIdSchema.safeParse(serverId);
    const parsedKey = jobKeySchema.safeParse(jobKey);
    if (!parsedId.success || !parsedKey.success) {
      return { success: false, error: "Invalid input" };
    }

    const response = await fetch(
      `${JOB_SERVER_URL}/api/jobs/servers/${parsedId.data}/config/${parsedKey.data}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || "Failed to reset job config",
      };
    }

    const data = await response.json();

    // Revalidate the jobs page
    revalidatePath(`/servers/${serverId}/settings/jobs`);

    return {
      success: true,
      config: data.config,
    };
  } catch (error) {
    console.error("Error resetting job config:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to reset job config",
    };
  }
}

/**
 * Get the list of all available job keys with their defaults
 */
export async function getJobDefaults() {
  return JOB_DEFAULTS;
}
