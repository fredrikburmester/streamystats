"use server";

import { db, servers } from "@streamystats/database";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { deleteServer as deleteServerFromDb } from "@/lib/db/server";
import { isUserAdmin } from "@/lib/db/users";

const deleteServerSchema = z.object({
  serverId: z.number().int().positive(),
});

const updateTimezoneSchema = z.object({
  serverId: z.number().int().positive(),
  timezone: z.string().min(1).max(100),
});

export async function deleteServerAction(serverId: number) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return { success: false, message: "Admin privileges required" };
    }

    const parsed = deleteServerSchema.safeParse({ serverId });
    if (!parsed.success) {
      return { success: false, message: "Invalid server ID" };
    }

    const result = await deleteServerFromDb({
      serverId: parsed.data.serverId,
    });

    if (result.success) {
      revalidatePath("/");
      revalidatePath("/servers");
      return { success: true, message: result.message };
    }
    return { success: false, message: result.message };
  } catch (error) {
    console.error("Server action - Error deleting server:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete server",
    };
  }
}

export async function updateServerTimezoneAction(
  serverId: number,
  timezone: string,
) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return { success: false, message: "Admin privileges required" };
    }

    const parsed = updateTimezoneSchema.safeParse({ serverId, timezone });
    if (!parsed.success) {
      return { success: false, message: "Invalid input" };
    }

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: parsed.data.timezone });
    } catch {
      return { success: false, message: "Invalid timezone identifier" };
    }

    await db
      .update(servers)
      .set({ timezone: parsed.data.timezone, updatedAt: new Date() })
      .where(eq(servers.id, parsed.data.serverId));

    revalidatePath(`/servers/${parsed.data.serverId}`);

    return { success: true, message: "Timezone updated successfully" };
  } catch (error) {
    console.error("Server action - Error updating timezone:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update timezone",
    };
  }
}
