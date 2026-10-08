"use server";

import { db } from "@streamystats/database";
import { servers } from "@streamystats/database/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { revalidateSeriesRecommendations } from "@/lib/db/similar-series-statistics";
import { revalidateRecommendations } from "@/lib/db/similar-statistics";
import { isUserAdmin } from "@/lib/db/users";

const schema = z.object({
  serverId: z.number().int().positive(),
  excludeStarted: z.boolean(),
});

export async function updateExcludeStartedAction(
  serverId: number,
  excludeStarted: boolean,
) {
  try {
    if (!(await isUserAdmin(serverId))) {
      return { success: false, message: "Admin privileges required" };
    }
    const parsed = schema.safeParse({ serverId, excludeStarted });
    if (!parsed.success) {
      return { success: false, message: "Invalid input" };
    }

    await db
      .update(servers)
      .set({ recommendationsExcludeStarted: parsed.data.excludeStarted })
      .where(eq(servers.id, parsed.data.serverId));

    // Cached recommendations were computed under the old rule.
    await revalidateRecommendations(parsed.data.serverId);
    await revalidateSeriesRecommendations(parsed.data.serverId);
    revalidatePath(`/servers/${parsed.data.serverId}/dashboard`);
    revalidatePath(`/servers/${parsed.data.serverId}/settings/ai`);

    return { success: true, message: "Recommendation settings updated" };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update settings",
    };
  }
}

const collectionsSchema = z.object({
  serverId: z.number().int().positive(),
  enabled: z.boolean(),
});

export async function updateRecommendationCollectionsAction(
  serverId: number,
  enabled: boolean,
) {
  try {
    if (!(await isUserAdmin(serverId))) {
      return { success: false, message: "Admin privileges required" };
    }
    const parsed = collectionsSchema.safeParse({ serverId, enabled });
    if (!parsed.success) {
      return { success: false, message: "Invalid input" };
    }

    await db
      .update(servers)
      .set({ recommendationCollectionsEnabled: parsed.data.enabled })
      .where(eq(servers.id, parsed.data.serverId));
    revalidatePath(`/servers/${parsed.data.serverId}/settings/ai`);

    // Create (or remove) the collections now rather than at the next run.
    const jobServerUrl =
      process.env.JOB_SERVER_URL && process.env.JOB_SERVER_URL !== "undefined"
        ? process.env.JOB_SERVER_URL
        : "http://localhost:3005";
    try {
      await fetch(
        `${jobServerUrl}/api/jobs/scheduler/trigger-recommendation-collections`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serverId: parsed.data.serverId }),
        },
      );
    } catch {
      // The scheduled run picks it up.
    }

    return {
      success: true,
      message: parsed.data.enabled
        ? "Recommendation collections enabled"
        : "Recommendation collections will be removed",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update settings",
    };
  }
}
