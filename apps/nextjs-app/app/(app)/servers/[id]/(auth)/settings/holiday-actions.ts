"use server";

import { db } from "@streamystats/database";
import { servers } from "@streamystats/database/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { isUserAdmin } from "@/lib/db/users";

const disabledHolidaysSchema = z.object({
  serverId: z.number().int().positive(),
  disabledHolidays: z.array(z.string().max(200)).max(500),
});

export async function updateDisabledHolidaysAction(
  serverId: number,
  disabledHolidays: string[],
) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return { success: false, message: "Admin privileges required" };
    }

    const parsed = disabledHolidaysSchema.safeParse({
      serverId,
      disabledHolidays,
    });
    if (!parsed.success) {
      return { success: false, message: "Invalid input" };
    }

    await db
      .update(servers)
      .set({ disabledHolidays: parsed.data.disabledHolidays })
      .where(eq(servers.id, parsed.data.serverId));

    revalidatePath(`/servers/${parsed.data.serverId}/dashboard`);
    revalidatePath(
      `/servers/${parsed.data.serverId}/settings/seasonal-recommendations`,
    );

    return { success: true, message: "Holiday settings updated" };
  } catch (error) {
    console.error("Error updating disabled holidays:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update settings",
    };
  }
}
