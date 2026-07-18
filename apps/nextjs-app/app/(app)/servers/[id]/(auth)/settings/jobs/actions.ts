"use server";

import { JOB_DEFAULTS, type JobKey } from "@streamystats/database";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { isUserAdmin } from "@/lib/db/users";
import {
  type JobConfigItem,
  jobServer,
  type ResetJobConfig,
  type UpdatedJobConfig,
} from "@/lib/job-server";

export type { JobConfigItem };

const serverIdSchema = z.number().int().positive();
const jobKeySchema = z.string().min(1).max(200);
const updateJobConfigSchema = z.object({
  cronExpression: z.string().max(200).nullish(),
  intervalSeconds: z.number().int().positive().max(86400).nullish(),
  enabled: z.boolean().optional(),
});

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

    const data = await jobServer.getJobConfigs(parsedId.data);
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
  config?: UpdatedJobConfig;
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

    const data = await jobServer.updateJobConfig({
      serverId: parsedId.data,
      jobKey: parsedKey.data,
      config: parsedConfig.data,
    });

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
  config?: ResetJobConfig;
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

    const data = await jobServer.resetJobConfig({
      serverId: parsedId.data,
      jobKey: parsedKey.data,
    });

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
