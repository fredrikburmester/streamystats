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
